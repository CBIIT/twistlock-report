import json
import os

from aws_cdk import Duration
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_events as events
from aws_cdk import aws_events_targets as targets
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as _lambda


class cveReportService:
    """Weekday CVE digest email per ECR repo.

    A scheduled Lambda (in the VPC, so it can reach the RDS instance) looks up the
    latest release tag for each configured repo, lists its CVEs from the
    vulnerability database, and emails the repo's recipients via SES.

    Recipients and settings come from ``config/cve_report.json``::

        {
          "sender": "shawn.wang@nih.gov",
          "schedule": "cron(0 14 ? * MON-FRI *)",   # 10am ET (EDT); UTC
          "registry": "<acct>.dkr.ecr.us-east-1.amazonaws.com",
          "repos": { "<image_name>": ["email", ...] }
        }

    Optional ``config.ini`` key (section ``[cvereport]``)::

        [cvereport]
        db_secret = ccdi-dcc/vuln-ingest/rds-credentials
    """

    def createService(self, config):
        service = "cvereport"
        prefix = self.namingPrefix
        name = f"{config['main']['resource_prefix']}-{config['main']['tier']}"
        region = config['main']['region']
        account = config['main']['account_id']

        def opt(key, default):
            return config[service][key] if config.has_option(service, key) else default

        db_secret = opt("db_secret", "ccdi-dcc/vuln-ingest/rds-credentials")

        with open(os.path.join(os.path.dirname(__file__), "..", "config", "cve_report.json")) as fp:
            report_config = json.load(fp)
        schedule = report_config.get("schedule", "cron(0 14 ? * MON-FRI *)")

        # Lambda egress to the RDS instance (same VPC path the app uses).
        security_group = ec2.SecurityGroup(
            self,
            "{}-{}-sg".format(prefix, service),
            vpc=self.VPC,
            allow_all_outbound=True,
            description="CVE report Lambda egress",
        )

        report_fn = _lambda.Function(
            self,
            "{}-{}-fn".format(prefix, service),
            function_name=f"{name}-cve-report",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="index.handler",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "lambda", "cvereport")
            ),
            timeout=Duration.minutes(2),
            memory_size=256,
            vpc=self.VPC,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[security_group],
            # Imported VPC route tables make CDK classify the selected subnet as
            # public; the Lambda only reaches the internal RDS host, so allow it.
            allow_public_subnet=True,
            environment={
                "DB_SECRET_NAME": db_secret,
                "REPORT_CONFIG": json.dumps(report_config),
            },
        )

        report_fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["secretsmanager:GetSecretValue"],
                resources=[
                    f"arn:aws:secretsmanager:{region}:{account}:secret:{db_secret}*"
                ],
            )
        )
        report_fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["ses:SendEmail", "ses:SendRawEmail"],
                resources=["*"],
            )
        )

        events.Rule(
            self,
            "{}-{}-schedule".format(prefix, service),
            rule_name=f"{name}-cve-report",
            schedule=events.Schedule.expression(schedule),
            targets=[targets.LambdaFunction(report_fn)],
        )
