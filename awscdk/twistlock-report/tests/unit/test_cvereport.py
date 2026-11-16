import importlib.util
import os
import sys
import unittest
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

    def test_selects_latest_ccdi_prefixed_version(self):
        report = self.load_report()
        connection = MagicMock()
        latest_release = (1, "ccdi-1.2.0.5", "2026-11-15", 1)
        connection.run.return_value = [
            (2, "ccdi-1.2.0.4", "2026-11-16", 2),
            latest_release,
        ]

        self.assertEqual(report._latest_scan(connection, "ccdi-hub-cgsexport"), latest_release)
        self.assertEqual(report._version_key("ccdi-1.2.0.5"), (1, 2, 0, 5))

    def test_publishes_repository_report_to_its_topic(self):
        report = self.load_report()
        topic_arn = "arn:aws:sns:us-east-1:123456789012:example"
        report.REPOS = {"example": topic_arn}
        report._sns = MagicMock()
        connection = MagicMock()
        with patch.object(report, "_db_connect", return_value=connection), patch.object(
            report, "_latest_scan", return_value=(1, "1.2.3", "today", 1)
        ), patch.object(
            report, "_vulnerabilities", return_value=[("CVE-1", "high", "pkg", "1", "fixed", 7)]
        ):
            report.handler({}, None)

        report._sns.publish.assert_called_once()
        publication = report._sns.publish.call_args.kwargs
        self.assertEqual(publication["TopicArn"], topic_arn)
        self.assertIn("example", publication["Subject"])
        self.assertIn("CVE-1", publication["Message"])
        connection.close.assert_called_once()

    def test_splits_large_report_and_limits_subject(self):
        report = self.load_report()
        report.REPOS = {"example": "arn:aws:sns:us-east-1:123456789012:example"}
        report._sns = MagicMock()
        body = "\u00e9" * 140000
        with patch.object(report, "_db_connect", return_value=MagicMock()), patch.object(
            report, "_latest_scan", return_value=(1, "1.2.3", "today", 1)
        ), patch.object(report, "_vulnerabilities", return_value=[]), patch.object(
            report, "_format_email", return_value=("long subject " * 20, body)
        ):
            report.handler({}, None)

        publications = [call.kwargs for call in report._sns.publish.call_args_list]
        self.assertGreater(len(publications), 1)
        self.assertEqual("".join(item["Message"] for item in publications), body)
        for index, item in enumerate(publications, 1):
            self.assertLessEqual(len(item["Message"].encode("utf-8")), 256 * 1024)
            self.assertLess(len(item["Subject"]), 100)
            self.assertTrue(item["Subject"].endswith(f"(part {index}/{len(publications)})"))

    def test_publishes_when_scan_is_missing(self):
        report = self.load_report()
        report.REPOS = {"example": "arn:aws:sns:us-east-1:123456789012:example"}
        report._sns = MagicMock()
        connection = MagicMock()
        with patch.object(report, "_db_connect", return_value=connection), patch.object(
            report, "_latest_scan", return_value=None
        ):
            report.handler({}, None)

        publication = report._sns.publish.call_args.kwargs
        self.assertIn("no scan data found", publication["Subject"])
        self.assertIn("No scan records", publication["Message"])
        connection.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()