import hashlib
import json
import os

from aws_cdk import Duration
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_events as events
from aws_cdk import aws_events_targets as targets
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as _lambda
from aws_cdk import aws_sns as sns
from aws_cdk import aws_sns_subscriptions as subs


class cveReportService:
    """Weekday CVE digest email per ECR repo.

    A scheduled Lambda (in the VPC, so it can reach the RDS instance and the
    internal Twistlock host) picks the most recently pushed versioned ECR tag for
    each configured repo, lists its CVEs from the vulnerability database (or a
    live Twistlock lookup when that tag is not in the DB yet), and publishes to an
    SNS topic. Repos with identical recipient lists share a single topic.

    Recipients and settings come from ``config/cve_report.json``::

        {
          "schedule": "cron(0 14 ? * MON-FRI *)",   # 10am ET (EDT); UTC
          "registry": "<acct>.dkr.ecr.us-east-1.amazonaws.com",
          "repos": { "<image_name>": ["email", ...] }
        }

    Optional ``config.ini`` keys (section ``[cvereport]``)::

        [cvereport]
        db_secret          = ccdi-dcc/vuln-ingest/rds-credentials
        twistlock_base_url = https://twistlock.nci.nih.gov
        twistlock_secret   = prod/twistlock
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
        twistlock_base_url = opt("twistlock_base_url", "https://twistlock.nci.nih.gov")
        twistlock_secret = opt("twistlock_secret", "prod/twistlock")

        with open(os.path.join(os.path.dirname(__file__), "..", "config", "cve_report.json")) as fp:
            report_config = json.load(fp)
        schedule = report_config.get("schedule", "cron(0 14 ? * MON-FRI *)")
        # Repos with the same recipient set share one topic, so each recipient
        # confirms a single subscription instead of one per repo.
        topics = {}
        repo_topics = {}
        for image_name, recipients in report_config.get("repos", {}).items():
            recipients = tuple(sorted({email.strip().lower() for email in recipients if email and email.strip()}))
            if not recipients:
                continue
            if recipients not in topics:
                key = hashlib.sha256(",".join(recipients).encode()).hexdigest()[:8]
                topic = sns.Topic(self, f"{prefix}-{service}-recipients-{key}-topic")
                for email in recipients:
                    topic.add_subscription(subs.EmailSubscription(email))
                topics[recipients] = topic
            repo_topics[image_name] = topics[recipients]

        runtime_config = {
            "subject_prefix": report_config.get("subject_prefix", "[CVE Report]"),
            "registry": report_config.get("registry", ""),
            "repos": {image_name: topic.topic_arn for image_name, topic in repo_topics.items()},
        }

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
            # Twistlock live lookups can be slow (ping alone takes seconds).
            timeout=Duration.minutes(5),
            memory_size=256,
            vpc=self.VPC,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[security_group],
            # Imported VPC route tables make CDK classify the selected subnet as
            # public, so allow it.
            allow_public_subnet=True,
            environment={
                "DB_SECRET_NAME": db_secret,
                "REPORT_CONFIG": json.dumps(runtime_config),
                "TWISTLOCK_BASE_URL": twistlock_base_url,
                "TWISTLOCK_SECRET": twistlock_secret,
            },
        )

        report_fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["secretsmanager:GetSecretValue"],
                resources=[
                    f"arn:aws:secretsmanager:{region}:{account}:secret:{db_secret}*",
                    f"arn:aws:secretsmanager:{region}:{account}:secret:{twistlock_secret}*",
                ],
            )
        )
        # The registry host is <account>.dkr.ecr.<region>.amazonaws.com.
        registry_parts = runtime_config["registry"].split(".")
        ecr_account, ecr_region = (
            (registry_parts[0], registry_parts[3]) if len(registry_parts) > 3 else (account, region)
        )
        if repo_topics:
            report_fn.add_to_role_policy(
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=["ecr:DescribeImages"],
                    resources=[
                        f"arn:aws:ecr:{ecr_region}:{ecr_account}:repository/{image_name}"
                        for image_name in repo_topics
                    ],
                )
            )
        for topic in topics.values():
            topic.grant_publish(report_fn)

        events.Rule(
            self,
            "{}-{}-schedule".format(prefix, service),
            rule_name=f"{name}-cve-report",
            schedule=events.Schedule.expression(schedule),
            targets=[targets.LambdaFunction(report_fn)],
        )
