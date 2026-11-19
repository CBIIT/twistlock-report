import importlib.util
import os
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch


LAMBDA_PATH = Path(__file__).resolve().parents[2] / "lambda" / "cvereport" / "index.py"


class CveReportTest(unittest.TestCase):
    def load_report(self):
        boto3 = MagicMock()
        with patch.dict(sys.modules, {"boto3": boto3}), patch.dict(
            os.environ, {"DB_SECRET_NAME": "test", "REPORT_CONFIG": "{}"}
        ):
            spec = importlib.util.spec_from_file_location("cvereport_lambda", LAMBDA_PATH)
            report = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(report)
        return report

    def test_latest_ecr_tag_uses_push_time_and_versioned_tags(self):
        report = self.load_report()
        report._ecr = MagicMock()
        report._ecr.get_paginator.return_value.paginate.return_value = [{"imageDetails": [
            {"imageTags": ["ccdi-1.2.0.98"], "imagePushedAt": datetime(2026, 6, 12)},
            {"imageTags": ["ccdi-1.2.0.7"], "imagePushedAt": datetime(2026, 11, 17, 11)},
            {"imageTags": ["cve-fix-nov.1"], "imagePushedAt": datetime(2026, 11, 17, 12)},
        ]}]

        self.assertEqual(report._latest_ecr_tag("ccdi-hub-cgsexport"),
                         ("ccdi-1.2.0.7", datetime(2026, 11, 17, 11)))

    def run_handler(self, report, repos, ecr, db=None, live=None, vulns=None):
        """Run the handler with ECR/DB/Twistlock lookups stubbed per repo name."""
        report.REPOS = repos
        report._sns = MagicMock()
        connection = MagicMock()
        with patch.object(report, "_db_connect", return_value=connection), patch.object(
            report, "_latest_ecr_tag", side_effect=lambda name: ecr.get(name)
        ), patch.object(
            report, "_db_scan_for_tag", side_effect=lambda _c, name, _t: (db or {}).get(name)
        ), patch.object(
            report, "_twistlock_scan", side_effect=lambda name, _t: (live or {}).get(name)
        ), patch.object(
            report, "_vulnerabilities", side_effect=lambda _c, scan_id: (vulns or {})[scan_id]
        ):
            report.handler({}, None)
        connection.close.assert_called_once()
        return {call.kwargs["TopicArn"]: call.kwargs for call in report._sns.publish.call_args_list}

    def test_uses_db_scan_for_latest_ecr_tag(self):
        report = self.load_report()
        topic = "arn:aws:sns:us-east-1:123456789012:example"
        published = self.run_handler(
            report, {"example": topic}, ecr={"example": ("1.2.3", "pushed")},
            db={"example": (1, "today")}, vulns={1: [("CVE-1", "high", "pkg", "1", "fixed", 7)]},
        )

        publication = published[topic]
        self.assertIn("example 1.2.3: 1 CVE(s)", publication["Subject"])
        self.assertIn("CVE-1", publication["Message"])
        self.assertIn("Source     : vulnerability DB", publication["Message"])

    def test_falls_back_to_live_twistlock_scan_when_tag_not_in_db(self):
        report = self.load_report()
        topic = "arn:aws:sns:us-east-1:123456789012:example"
        published = self.run_handler(
            report, {"example": topic}, ecr={"example": ("ccdi-1.2.0.7", "pushed")},
            live={"example": ("2026-11-18T00:00:00Z", [("CVE-LIVE", "critical", "openssl", "3", "fixed", 9.8)])},
        )

        publication = published[topic]
        self.assertIn("ccdi-1.2.0.7: 1 CVE(s)", publication["Subject"])
        self.assertIn("CVE-LIVE", publication["Message"])
        self.assertIn("Twistlock (live lookup", publication["Message"])

    def test_twistlock_scan_matches_exact_repo_and_tag(self):
        report = self.load_report()
        results = [
            {"repoTag": {"repo": "example", "tag": "1.0.0.10"}, "scanTime": "new",
             "vulnerabilities": [{"cve": "CVE-WRONG", "severity": "high"}]},
            {"repoTag": {"repo": "example", "tag": "1.0.0.1"}, "scanTime": "old",
             "vulnerabilities": [{"cve": "CVE-B", "severity": "low"}, {"cve": "CVE-A", "severity": "critical"},
                                 {"cve": "", "severity": "high"}]},
        ]
        with patch.object(report, "_twistlock_auth", return_value="token"), patch.object(
            report, "_twistlock_request", return_value=results
        ):
            scan_time, vulns = report._twistlock_scan("example", "1.0.0.1")

        self.assertEqual(scan_time, "old")
        self.assertEqual([v[0] for v in vulns], ["CVE-A", "CVE-B"])

    def test_groups_repositories_sharing_a_topic_into_one_email(self):
        report = self.load_report()
        shared = "arn:aws:sns:us-east-1:123456789012:shared"
        other = "arn:aws:sns:us-east-1:123456789012:other"
        published = self.run_handler(
            report, {"repo-a": shared, "repo-b": shared, "repo-c": other, "repo-d": shared},
            ecr={"repo-a": ("1.0.0", "p"), "repo-b": ("2.0.0", "p"), "repo-c": ("3.0.0", "p")},
            db={"repo-a": (1, "today"), "repo-c": (3, "today")},
            vulns={1: [("CVE-A", "high", "pkg", "1", "fixed", 7)], 3: [("CVE-C", "low", "pkg", "1", "", 2)]},
        )

        self.assertEqual(len(published), 2)
        digest = published[shared]
        self.assertIn("3 repos: 1 CVE(s)", digest["Subject"])
        self.assertIn("CVE-A", digest["Message"])
        self.assertIn("2.0.0: not scanned yet", digest["Message"])
        self.assertIn("no versioned image tag found in ECR", digest["Message"])
        self.assertNotIn("CVE-C", digest["Message"])
        self.assertIn("repo-c", published[other]["Subject"])

    def test_failed_repository_lookup_does_not_block_digest(self):
        report = self.load_report()
        topic = "arn:aws:sns:us-east-1:123456789012:shared"
        report.REPOS = {"broken": topic, "ok": topic}
        report._sns = MagicMock()

        def latest(name):
            if name == "broken":
                raise RuntimeError("ECR unavailable")
            return ("1.0.0", "p")

        with patch.object(report, "_db_connect", return_value=MagicMock()), patch.object(
            report, "_latest_ecr_tag", side_effect=latest
        ), patch.object(report, "_db_scan_for_tag", return_value=(1, "today")), patch.object(
            report, "_vulnerabilities", return_value=[("CVE-OK", "low", "pkg", "1", "", 1)]
        ):
            report.handler({}, None)

        message = report._sns.publish.call_args.kwargs["Message"]
        self.assertIn("error: RuntimeError", message)
        self.assertIn("CVE-OK", message)

    def test_splits_large_report_and_limits_subject(self):
        report = self.load_report()
        report.REPOS = {"example": "arn:aws:sns:us-east-1:123456789012:example"}
        report._sns = MagicMock()
        body = "\u00e9" * 140000
        with patch.object(report, "_db_connect", return_value=MagicMock()), patch.object(
            report, "_latest_ecr_tag", return_value=("1.2.3", "p")
        ), patch.object(report, "_db_scan_for_tag", return_value=(1, "today")), patch.object(
            report, "_vulnerabilities", return_value=[]
        ), patch.object(report, "_format_email", return_value=("long subject " * 20, body)):
            report.handler({}, None)

        publications = [call.kwargs for call in report._sns.publish.call_args_list]
        self.assertGreater(len(publications), 1)
        self.assertEqual("".join(item["Message"] for item in publications), body)
        for index, item in enumerate(publications, 1):
            self.assertLessEqual(len(item["Message"].encode("utf-8")), 256 * 1024)
            self.assertLess(len(item["Subject"]), 100)
            self.assertTrue(item["Subject"].endswith(f"(part {index}/{len(publications)})"))


if __name__ == "__main__":
    unittest.main()