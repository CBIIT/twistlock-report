import json
import sys
import unittest
from configparser import ConfigParser
from pathlib import Path
from unittest.mock import mock_open, patch

import aws_cdk as cdk
from aws_cdk import assertions
from aws_cdk import aws_ec2 as ec2


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
from services import cvereport


class CveReportStackTest(unittest.TestCase):
    def test_synthesizes_topics_per_recipient_set_and_scoped_permissions(self):
        app = cdk.App()
        stack = cdk.Stack(app, "ReportTest")
        stack.namingPrefix = "test"
        stack.VPC = ec2.Vpc(stack, "Vpc", max_azs=2, nat_gateways=1)
        config = ConfigParser()
        config.read_dict({"main": {
            "resource_prefix": "test", "tier": "dev", "region": "us-east-1",
            "account_id": "123456789012",
        }})
        report_config = {
            "repos": {
                "repo-one": ["one@example.com", "one@example.com"],
                "repo-two": ["two@example.com"],
                "repo-three": [" One@example.com"],
                "repo-empty": [],
            }
        }
        with patch.object(cvereport, "open", mock_open(read_data=json.dumps(report_config)), create=True):
            cvereport.cveReportService.createService(stack, config)
        template = assertions.Template.from_stack(stack).to_json()
        resources = template["Resources"]
        topics = {key: value for key, value in resources.items() if value["Type"] == "AWS::SNS::Topic"}
        subscriptions = [value["Properties"] for value in resources.values() if value["Type"] == "AWS::SNS::Subscription"]
        self.assertEqual(len(topics), 2)
        self.assertEqual(len(subscriptions), 2)
        self.assertEqual({item["Endpoint"] for item in subscriptions}, {"one@example.com", "two@example.com"})
        self.assertTrue(all(item["Protocol"] == "email" for item in subscriptions))

        function = next(value for value in resources.values() if value["Type"] == "AWS::Lambda::Function")
        config_parts = function["Properties"]["Environment"]["Variables"]["REPORT_CONFIG"]["Fn::Join"][1]
        runtime_config = json.loads("".join(part if isinstance(part, str) else part["Ref"] for part in config_parts))
        subscription_topics = {item["Endpoint"]: item["TopicArn"]["Ref"] for item in subscriptions}
        self.assertEqual(runtime_config["repos"], {
            "repo-one": subscription_topics["one@example.com"],
            "repo-two": subscription_topics["two@example.com"],
            "repo-three": subscription_topics["one@example.com"],
        })

        statements = [statement for resource in resources.values() if resource["Type"] == "AWS::IAM::Policy"
                      for statement in resource["Properties"]["PolicyDocument"]["Statement"]]
        published_topics = set()
        for statement in statements:
            if statement["Action"] == "sns:Publish":
                publish_resources = statement["Resource"]
                if isinstance(publish_resources, dict):
                    publish_resources = [publish_resources]
                published_topics.update(resource["Ref"] for resource in publish_resources)
        self.assertEqual(published_topics, set(topics))
        self.assertNotIn("ses:Send", json.dumps(statements))

        ecr_statement = next(s for s in statements if s["Action"] == "ecr:DescribeImages")
        self.assertEqual(set(ecr_statement["Resource"]), {
            f"arn:aws:ecr:us-east-1:123456789012:repository/{name}"
            for name in ("repo-one", "repo-two", "repo-three")
        })
        env = function["Properties"]["Environment"]["Variables"]
        self.assertEqual(env["TWISTLOCK_SECRET"], "prod/twistlock")
        secret_statement = next(s for s in statements if s["Action"] == "secretsmanager:GetSecretValue")
        self.assertIn("prod/twistlock", json.dumps(secret_statement["Resource"]))


if __name__ == "__main__":
    unittest.main()