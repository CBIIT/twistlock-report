"""Twistlock API health check.

Runs on a schedule (EventBridge), probes one or more Twistlock endpoints, and
publishes an ``ApiHealthy`` CloudWatch metric (1 = healthy, 0 = down). A
CloudWatch alarm on that metric drives the email notifications (down + recovery),
so this function never emails directly.

Enabled probes are controlled by the ``CHECKS`` environment variable
(comma-separated). Supported probes:

* ``ping``     GET /api/v1/_ping           - basic reachability
* ``version``  GET /api/v1/version         - basic reachability (authenticated)
* ``auth``     POST /api/v1/authenticate   - login works (needs TWISTLOCK_SECRET)
* ``registry`` GET /api/v1/registry?...    - the heavy listing endpoint that
                                             actually fails in production
                                             (needs a token from ``auth``)

Only the Python standard library and boto3 (bundled in the Lambda runtime) are
used, so the asset needs no build step.
"""

import json
import os
import time
import urllib.error
import urllib.request

import boto3

BASE_URL = os.environ.get("TWISTLOCK_BASE_URL", "https://twistlock.nci.nih.gov").rstrip("/")
CHECKS = [c.strip() for c in os.environ.get("CHECKS", "ping,version").split(",") if c.strip()]
TIMEOUT = float(os.environ.get("TIMEOUT_SECONDS", "20"))
SECRET_ID = os.environ.get("TWISTLOCK_SECRET", "")
NAMESPACE = os.environ.get("METRIC_NAMESPACE", "TwistlockHealth")
SERVICE_DIM = os.environ.get("SERVICE_NAME", "twistlock")

cloudwatch = boto3.client("cloudwatch")
_secrets = boto3.client("secretsmanager")

# The authenticated listing probe uses the same query shape the app issues.
_REGISTRY_QUERY = (
    "collections=CRDC+CCDI+All+Collection&compact=true&offset=0"
    "&project=Central+Console&sort=scanTime&search=ccdi&limit=1"
)


def _http(method, path, headers=None, body=None):
    """Return (status, elapsed_seconds, error_name). status is None on transport error."""
    url = BASE_URL + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    if body is not None:
        req.add_header("Content-Type", "application/json")
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            resp.read()
            return resp.status, time.time() - start, None
    except urllib.error.HTTPError as exc:
        return exc.code, time.time() - start, None
    except Exception as exc:  # noqa: BLE001 - timeouts, DNS, connection resets, etc.
        return None, time.time() - start, type(exc).__name__


def _get_credentials():
    secret = _secrets.get_secret_value(SecretId=SECRET_ID)["SecretString"]
    data = json.loads(secret)
    return data["username"], data["password"]


def _authenticate():
    """Return (token, status, elapsed, error)."""
    username, password = _get_credentials()
    url = BASE_URL + "/api/v1/authenticate"
    payload = json.dumps({"username": username, "password": password}).encode()
    req = urllib.request.Request(
        url, data=payload, method="POST", headers={"Content-Type": "application/json"}
    )
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            token = json.loads(resp.read()).get("token")
            return token, resp.status, time.time() - start, None
    except urllib.error.HTTPError as exc:
        return None, exc.code, time.time() - start, None
    except Exception as exc:  # noqa: BLE001
        return None, None, time.time() - start, type(exc).__name__


def _run_checks():
    results = []
    token = None

    def record(name, status, elapsed, error, healthy):
        results.append(
            {
                "endpoint": name,
                "status": status,
                "latency_ms": round(elapsed * 1000),
                "error": error,
                "healthy": healthy,
            }
        )

    if "ping" in CHECKS:
        status, elapsed, error = _http("GET", "/api/v1/_ping")
        record("ping", status, elapsed, error, status == 200)

    if "version" in CHECKS:
        # /api/v1/version requires auth, so an unauthenticated probe returns 401
        # when the service is up. Any fast, non-5xx HTTP response proves the front
        # door is reachable; timeouts (status is None) and 5xx mean it is down.
        status, elapsed, error = _http("GET", "/api/v1/version")
        record("version", status, elapsed, error, status is not None and status < 500)

    if "auth" in CHECKS or "registry" in CHECKS:
        token, status, elapsed, error = _authenticate()
        if "auth" in CHECKS:
            record("authenticate", status, elapsed, error, status == 200 and bool(token))

    if "registry" in CHECKS:
        if token:
            status, elapsed, error = _http(
                "GET",
                "/api/v1/registry?" + _REGISTRY_QUERY,
                headers={"Authorization": "Bearer " + token},
            )
            record("registry", status, elapsed, error, status == 200)
        else:
            record("registry", None, 0.0, "NoToken", False)

    return results


def _put_metrics(results):
    now = time.time()
    metric_data = []
    overall_healthy = all(r["healthy"] for r in results) if results else False

    metric_data.append(
        {
            "MetricName": "ApiHealthy",
            "Dimensions": [{"Name": "Service", "Value": SERVICE_DIM}],
            "Value": 1.0 if overall_healthy else 0.0,
            "Unit": "None",
        }
    )
    for r in results:
        dims = [
            {"Name": "Service", "Value": SERVICE_DIM},
            {"Name": "Endpoint", "Value": r["endpoint"]},
        ]
        metric_data.append(
            {"MetricName": "EndpointHealthy", "Dimensions": dims,
             "Value": 1.0 if r["healthy"] else 0.0, "Unit": "None"}
        )
        metric_data.append(
            {"MetricName": "LatencyMs", "Dimensions": dims,
             "Value": float(r["latency_ms"]), "Unit": "Milliseconds"}
        )

    cloudwatch.put_metric_data(Namespace=NAMESPACE, MetricData=metric_data)
    return overall_healthy


def handler(event, context):
    results = _run_checks()
    overall_healthy = _put_metrics(results)
    summary = {"healthy": overall_healthy, "base_url": BASE_URL, "results": results}
    print(json.dumps(summary))
    return summary
