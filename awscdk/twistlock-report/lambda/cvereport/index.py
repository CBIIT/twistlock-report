"""Weekday CVE digest.

For each configured ECR repo, finds the latest release tag (highest dotted-numeric
version, e.g. 2.0.1.23) recorded in the vulnerability database, lists every CVE on
that image, and emails the repo's recipients via SES.

Runtime config comes from environment variables set by the CDK service:

* ``DB_SECRET_NAME``   Secrets Manager id holding the RDS credentials
                       (keys: username, password, host, port, dbname).
* ``REPORT_CONFIG``    JSON: {"sender", "subject_prefix", "registry",
                       "repos": {"<image_name>": ["email", ...]}}.

Only boto3 (bundled) and the vendored pure-Python pg8000 driver are used, so the
asset needs no build step.
"""

import json
import os
import re
import ssl
import sys

# Vendored dependencies (pg8000 and its pure-Python deps) live next to this file.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "vendor"))

import pg8000.native  # noqa: E402  (import after sys.path tweak)
import boto3  # noqa: E402

DB_SECRET_NAME = os.environ["DB_SECRET_NAME"]
CONFIG = json.loads(os.environ.get("REPORT_CONFIG", "{}"))

SENDER = CONFIG.get("sender", "")
SUBJECT_PREFIX = CONFIG.get("subject_prefix", "[CVE Report]")
REGISTRY = CONFIG.get("registry", "")
REPOS = CONFIG.get("repos", {})

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
# Match a 3- or 4-part dotted version embedded anywhere in a tag (prod-2.0.1.23,
# 4.3.0.527, prod-20260422-1016-4.7.1.4 -> 4.7.1.4).
_VERSION_RE = re.compile(r"\d+(?:\.\d+){2,3}")

_secrets = boto3.client("secretsmanager")
_ses = boto3.client("ses")


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


def _latest_scan(conn, image_name):
    """Return (scan_id, tag, scanned_at, vuln_count) for the latest release, or None."""
    rows = conn.run(
        """
        SELECT s.id, COALESCE(s.scanned_tag, itm.current_tag) AS tag,
               s.scanned_at, s.vuln_count
        FROM scans s
        JOIN image_tag_mapping itm ON itm.id = s.component_id
        WHERE itm.image_name = :image_name
        """,
        image_name=image_name,
    )
    if not rows:
        return None

    def sort_key(row):
        version = _version_key(row[1])
        # Prefer the highest version; fall back to most recent scan time.
        return (version is not None, version or (), row[2])

    return max(rows, key=sort_key)


def _vulnerabilities(conn, scan_id):
    rows = conn.run(
        """
        SELECT cve_id, severity, package_name, package_version, fix_status, cvss
        FROM vulnerabilities
        WHERE scan_id = :scan_id AND cve_id IS NOT NULL
        """,
        scan_id=scan_id,
    )
    rows.sort(key=lambda r: (SEVERITY_ORDER.get((r[1] or "").lower(), 99), r[0]))
    return rows


def _format_email(image_name, tag, scanned_at, vulns):
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


def handler(event, context):
    sent = []
    conn = _db_connect()
    try:
        for image_name, recipients in REPOS.items():
            recipients = [r.strip() for r in recipients if r and r.strip()]
            if not recipients:
                continue

            latest = _latest_scan(conn, image_name)
            if latest is None:
                subject = f"{SUBJECT_PREFIX} {image_name}: no scan data found"
                body = (
                    f"No scan records were found for repository '{image_name}'.\n"
                    "Either the image has not been ingested yet or the name is misconfigured."
                )
            else:
                scan_id, tag, scanned_at, _vuln_count = latest
                vulns = _vulnerabilities(conn, scan_id)
                subject, body = _format_email(image_name, tag, scanned_at, vulns)

            _ses.send_email(
                Source=SENDER,
                Destination={"ToAddresses": recipients},
                Message={
                    "Subject": {"Data": subject},
                    "Body": {"Text": {"Data": body}},
                },
            )
            sent.append({"image_name": image_name, "recipients": recipients, "subject": subject})
    finally:
        conn.close()

    result = {"sent": sent}
    print(json.dumps(result, default=str))
    return result
