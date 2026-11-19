"""Weekday CVE digest.

For each configured ECR repo, finds the latest release tag (the most recently
pushed ECR image whose tag contains a dotted version, e.g. ccdi-1.2.0.7), lists
every CVE on that image, and publishes the report to the repo's SNS topic. Repos
that share a topic are combined into a single digest email.

CVEs come from the vulnerability database scan for that exact tag; when the tag
has not been ingested yet, the Twistlock registry API is queried live instead.

Runtime config comes from environment variables set by the CDK service:

* ``DB_SECRET_NAME``      Secrets Manager id holding the RDS credentials
                          (keys: username, password, host, port, dbname).
* ``REPORT_CONFIG``       JSON: {"subject_prefix", "registry",
                          "repos": {"<image_name>": "<topic_arn>"}}.
* ``TWISTLOCK_BASE_URL``  Twistlock console URL for the live lookup.
* ``TWISTLOCK_SECRET``    Secrets Manager id holding Twistlock username/password.

Only boto3 (bundled) and the vendored pure-Python pg8000 driver are used, so the
asset needs no build step.
"""

import json
import os
import re
import ssl
import sys
import urllib.parse
import urllib.request

# Vendored dependencies (pg8000 and its pure-Python deps) live next to this file.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "vendor"))

import pg8000.native  # noqa: E402  (import after sys.path tweak)
import boto3  # noqa: E402

DB_SECRET_NAME = os.environ["DB_SECRET_NAME"]
CONFIG = json.loads(os.environ.get("REPORT_CONFIG", "{}"))

SUBJECT_PREFIX = CONFIG.get("subject_prefix", "[CVE Report]")
REGISTRY = CONFIG.get("registry", "")
REPOS = CONFIG.get("repos", {})
TWISTLOCK_BASE_URL = os.environ.get("TWISTLOCK_BASE_URL", "https://twistlock.nci.nih.gov").rstrip("/")
TWISTLOCK_SECRET = os.environ.get("TWISTLOCK_SECRET", "")
TWISTLOCK_TIMEOUT = float(os.environ.get("TWISTLOCK_TIMEOUT_SECONDS", "60"))

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
# Match a 3- or 4-part dotted version embedded anywhere in a tag (prod-2.0.1.23,
# 4.3.0.527, prod-20260422-1016-4.7.1.4 -> 4.7.1.4).
_VERSION_RE = re.compile(r"\d+(?:\.\d+){2,3}")

_secrets = boto3.client("secretsmanager")
_sns = boto3.client("sns")
_ecr = boto3.client("ecr")
_twistlock_token = None


def _db_connect():
    secret = json.loads(_secrets.get_secret_value(SecretId=DB_SECRET_NAME)["SecretString"])
    # Encrypt in transit; skip cert verification since the internal RDS CA is not
    # in the Lambda trust store and traffic stays within the private VPC.
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.native.Connection(
        user=secret["username"],
        password=secret["password"],
        host=secret["host"],
        port=int(secret.get("port", 5432)),
        database=secret["dbname"],
        ssl_context=ctx,
    )


def _version_key(tag):
    """Return the highest dotted-numeric version in a tag as an int tuple, or None."""
    best = None
    for match in _VERSION_RE.findall(tag or ""):
        parts = tuple(int(p) for p in match.split("."))
        if best is None or parts > best:
            best = parts
    return best


def _latest_ecr_tag(image_name):
    """Return (tag, pushed_at) for the newest pushed image with a versioned tag, or None.

    Push time is used instead of version ordering because version numbers get
    reset (e.g. ccdi-1.2.0.98 was followed by ccdi-1.2.0.3).
    """
    best = None
    pages = _ecr.get_paginator("describe_images").paginate(
        repositoryName=image_name, filter={"tagStatus": "TAGGED"}
    )
    for page in pages:
        for image in page.get("imageDetails", []):
            tags = [t for t in image.get("imageTags", []) if _version_key(t)]
            if not tags:
                continue
            pushed_at = image["imagePushedAt"]
            if best is None or pushed_at > best[1]:
                best = (max(tags, key=_version_key), pushed_at)
    return best


def _db_scan_for_tag(conn, image_name, tag):
    """Return (scan_id, scanned_at) of the newest DB scan for this exact tag, or None."""
    rows = conn.run(
        """
        SELECT s.id, s.scanned_at
        FROM scans s
        JOIN image_tag_mapping itm ON itm.id = s.component_id
        WHERE itm.image_name = :image_name
          AND COALESCE(s.scanned_tag, itm.current_tag) = :tag
        ORDER BY s.scanned_at DESC
        LIMIT 1
        """,
        image_name=image_name,
        tag=tag,
    )
    return tuple(rows[0]) if rows else None


def _twistlock_request(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(TWISTLOCK_BASE_URL + path, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=TWISTLOCK_TIMEOUT) as resp:
        return json.loads(resp.read() or b"null")


def _twistlock_auth():
    global _twistlock_token
    if _twistlock_token is None:
        secret = json.loads(_secrets.get_secret_value(SecretId=TWISTLOCK_SECRET)["SecretString"])
        result = _twistlock_request(
            "POST", "/api/v1/authenticate",
            body={"username": secret["username"], "password": secret["password"]},
        )
        _twistlock_token = result["token"]
    return _twistlock_token


def _twistlock_scan(image_name, tag):
    """Live-query Twistlock for this image tag; return (scan_time, vulns) or None."""
    params = {"registry": REGISTRY} if REGISTRY else {}
    params["search"] = f"{image_name}:{tag}"
    query = urllib.parse.urlencode(params)
    results = _twistlock_request("GET", f"/api/v34.03/registry?{query}", token=_twistlock_auth()) or []
    matches = [
        r for r in results
        if (r.get("repoTag") or {}).get("repo") == image_name and (r.get("repoTag") or {}).get("tag") == tag
    ]
    if not matches:
        return None
    scan = max(matches, key=lambda r: r.get("scanTime") or "")
    vulns = [
        (v.get("cve"), v.get("severity"), v.get("packageName"), v.get("packageVersion"),
         v.get("status"), v.get("cvss"))
        for v in scan.get("vulnerabilities") or []
        if v.get("cve")
    ]
    return scan.get("scanTime"), _sort_vulns(vulns)


def _sort_vulns(vulns):
    return sorted(vulns, key=lambda r: (SEVERITY_ORDER.get((r[1] or "").lower(), 99), r[0]))


def _vulnerabilities(conn, scan_id):
    rows = conn.run(
        """
        SELECT cve_id, severity, package_name, package_version, fix_status, cvss
        FROM vulnerabilities
        WHERE scan_id = :scan_id AND cve_id IS NOT NULL
        """,
        scan_id=scan_id,
    )
    return _sort_vulns(rows)


def _format_email(image_name, tag, scanned_at, vulns, source="vulnerability DB"):
    image_ref = f"{REGISTRY}/{image_name}:{tag}" if REGISTRY else f"{image_name}:{tag}"
    counts = {}
    for _cve, severity, *_rest in vulns:
        key = (severity or "unknown").upper()
        counts[key] = counts.get(key, 0) + 1
    count_line = ", ".join(f"{k}: {v}" for k, v in sorted(counts.items())) or "none"

    lines = [
        f"Repository : {image_name}",
        f"Latest tag : {tag}",
        f"Image      : {image_ref}",
        f"Scanned at : {scanned_at}",
        f"Source     : {source}",
        f"Total CVEs : {len(vulns)}  ({count_line})",
        "",
    ]
    if vulns:
        lines.append("CVEs (sorted by severity):")
        for cve, severity, pkg, pkg_version, fix_status, cvss in vulns:
            pkg_part = f"{pkg} {pkg_version}".strip()
            cvss_part = f"CVSS {cvss}" if cvss is not None else ""
            fix_part = f"fix: {fix_status}" if fix_status else ""
            detail = " | ".join(p for p in [pkg_part, cvss_part, fix_part] if p)
            lines.append(f"  [{(severity or '?').upper()}] {cve}{(' - ' + detail) if detail else ''}")
    else:
        lines.append("No CVEs recorded for the latest release.")

    subject = f"{SUBJECT_PREFIX} {image_name} {tag}: {len(vulns)} CVE(s)"
    return subject, "\n".join(lines)


def _publish_report(topic_arn, subject, body):
    message_bytes = body.encode("utf-8")
    chunks = []
    while message_bytes:
        chunk = message_bytes[:250 * 1024].decode("utf-8", errors="ignore")
        if len(message_bytes) > 250 * 1024 and "\n" in chunk:
            chunk = chunk[:chunk.rfind("\n") + 1]
        chunks.append(chunk)
        message_bytes = message_bytes[len(chunk.encode("utf-8")):]

    subject = re.sub(r"[\x00-\x1f\x7f]", " ", subject)
    for index, chunk in enumerate(chunks, 1):
        suffix = f" (part {index}/{len(chunks)})" if len(chunks) > 1 else ""
        _sns.publish(TopicArn=topic_arn, Subject=subject[:99 - len(suffix)] + suffix, Message=chunk)


def _format_digest(reports):
    """Combine per-repo reports (dicts) that share a topic into one subject/body."""
    if len(reports) == 1:
        return reports[0]["subject"], reports[0]["body"]

    total = sum(r["cve_count"] or 0 for r in reports)
    width = max(len(r["image_name"]) for r in reports)
    lines = [f"CVE summary for {len(reports)} repositories:", ""]
    for r in reports:
        lines.append(f"  {r['image_name'].ljust(width)}  {r['status']}")
    for r in reports:
        lines += ["", "=" * 72, r["body"]]

    subject = f"{SUBJECT_PREFIX} {len(reports)} repos: {total} CVE(s)"
    return subject, "\n".join(lines)


def _build_report(conn, image_name):
    """Return the report dict for one repo: tag, cve_count, status, subject, body."""
    report = {"image_name": image_name, "tag": None, "cve_count": None}
    try:
        latest = _latest_ecr_tag(image_name)
        if latest is None:
            report["status"] = "no versioned image tag found in ECR"
            report["subject"] = f"{SUBJECT_PREFIX} {image_name}: {report['status']}"
            report["body"] = (
                f"Repository : {image_name}\n"
                "No image with a dotted-version tag (e.g. 1.2.0.7) was found in ECR."
            )
            return report

        tag, pushed_at = latest
        report["tag"] = tag
        db_scan = _db_scan_for_tag(conn, image_name, tag)
        if db_scan is not None:
            scan_id, scanned_at = db_scan
            vulns, source = _vulnerabilities(conn, scan_id), "vulnerability DB"
        else:
            live = _twistlock_scan(image_name, tag)
            if live is None:
                report["status"] = f"{tag}: not scanned yet"
                report["subject"] = f"{SUBJECT_PREFIX} {image_name} {tag}: not scanned yet"
                report["body"] = (
                    f"Repository : {image_name}\n"
                    f"Latest tag : {tag}  (pushed {pushed_at})\n"
                    "No scan for this tag was found in the vulnerability DB or Twistlock."
                )
                return report
            scanned_at, vulns = live
            source = "Twistlock (live lookup; not yet in vulnerability DB)"

        report["cve_count"] = len(vulns)
        report["status"] = f"{tag}: {len(vulns)} CVE(s)"
        report["subject"], report["body"] = _format_email(image_name, tag, scanned_at, vulns, source)
    except Exception as exc:  # noqa: BLE001 - one bad repo must not block the digest
        print(f"Report for {image_name} failed: {exc!r}")
        report["status"] = f"error: {type(exc).__name__}"
        report["subject"] = f"{SUBJECT_PREFIX} {image_name}: report failed"
        report["body"] = f"Repository : {image_name}\nReport failed: {exc!r}"
    return report


def handler(event, context):
    reports_by_topic = {}
    conn = _db_connect()
    try:
        for image_name, topic_arn in REPOS.items():
            reports_by_topic.setdefault(topic_arn, []).append(_build_report(conn, image_name))
    finally:
        conn.close()

    # One email per topic: repos that share recipients are grouped into a digest.
    sent = []
    for topic_arn, reports in reports_by_topic.items():
        subject, body = _format_digest(reports)
        _publish_report(topic_arn, subject, body)
        sent.append({
            "image_names": [r["image_name"] for r in reports],
            "topic_arn": topic_arn,
            "subject": subject,
        })

    result = {"sent": sent}
    print(json.dumps(result, default=str))
    return result
