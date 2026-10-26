import os

from aws_cdk import Duration
from aws_cdk import aws_cloudwatch as cloudwatch
from aws_cdk import aws_cloudwatch_actions as cw_actions
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_events as events
from aws_cdk import aws_events_targets as targets
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as _lambda
from aws_cdk import aws_sns as sns
from aws_cdk import aws_sns_subscriptions as subs


class healthCheckService:
    """Scheduled Twistlock API health check with email alerting.

    A Lambda (in the VPC, so it can reach the internal Twistlock host) probes the
    configured endpoints hourly and publishes an ``ApiHealthy`` CloudWatch
    metric. A CloudWatch alarm on that metric emails the on-call address when the
    API goes down and again when it recovers.

    Optional ``config.ini`` keys (section ``[healthcheck]``), all with safe
    defaults so the stack synthesizes even if the section is absent::

        [healthcheck]
        alert_email        = shawn.wang@nih.gov
        twistlock_base_url = https://twistlock.nci.nih.gov
        schedule           = rate(1 hour)
        checks             = ping,version          ; add auth,registry to catch the
                                                   ; listing-endpoint outage
        timeout_seconds    = 20
        twistlock_secret   = prod/twistlock        ; only needed for auth/registry
    """

    def createService(self, config):
        service = "healthcheck"
        prefix = self.namingPrefix
        name = f"{config['main']['resource_prefix']}-{config['main']['tier']}"
        region = config['main']['region']
        account = config['main']['account_id']

        def opt(key, default):
            return config[service][key] if config.has_option(service, key) else default

        alert_email = opt("alert_email", "shawn.wang@nih.gov")
        base_url = opt("twistlock_base_url", "https://twistlock.nci.nih.gov")
        schedule = opt("schedule", "rate(1 hour)")
        checks = opt("checks", "ping,version")
        timeout_seconds = opt("timeout_seconds", "20")
        secret_name = opt("twistlock_secret", "prod/twistlock")

        # SNS topic + email subscription (recipient must confirm via emailed link).
        topic = sns.Topic(
            self,
            "{}-{}-topic".format(prefix, service),
            topic_name=f"{name}-twistlock-health",
            display_name="Twistlock API Health",
        )
        topic.add_subscription(subs.EmailSubscription(alert_email))

        # Lambda runs in the VPC private subnets (same path the Fargate task uses
        # to reach the internal Twistlock host); allow all egress.
        security_group = ec2.SecurityGroup(
            self,
            "{}-{}-sg".format(prefix, service),
            vpc=self.VPC,
            allow_all_outbound=True,
            description="Twistlock health check Lambda egress",
        )

        health_fn = _lambda.Function(
            self,
            "{}-{}-fn".format(prefix, service),
            function_name=f"{name}-twistlock-health",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="index.handler",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "lambda", "healthcheck")
            ),
            timeout=Duration.seconds(int(timeout_seconds) + 40),
            memory_size=256,
            vpc=self.VPC,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[security_group],
            environment={
                "TWISTLOCK_BASE_URL": base_url,
                "CHECKS": checks,
                "TIMEOUT_SECONDS": str(timeout_seconds),
                "TWISTLOCK_SECRET": secret_name,
                "METRIC_NAMESPACE": "TwistlockHealth",
                "SERVICE_NAME": name,
            },
        )

        health_fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["cloudwatch:PutMetricData"],
                resources=["*"],
            )
        )
        # Only needed when the auth/registry probes are enabled.
        health_fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["secretsmanager:GetSecretValue"],
                resources=[
                    f"arn:aws:secretsmanager:{region}:{account}:secret:{secret_name}*"
                ],
            )
        )

        events.Rule(
            self,
            "{}-{}-schedule".format(prefix, service),
            rule_name=f"{name}-twistlock-health",
            schedule=events.Schedule.expression(schedule),
            targets=[targets.LambdaFunction(health_fn)],
        )

        # Alarm on the overall health metric. Period matches the hourly schedule;
        # BREACHING on missing data means a dead checker also raises the alarm.
        metric = cloudwatch.Metric(
            namespace="TwistlockHealth",
            metric_name="ApiHealthy",
            dimensions_map={"Service": name},
            period=Duration.hours(1),
            statistic="Minimum",
        )
        alarm = cloudwatch.Alarm(
            self,
            "{}-{}-alarm".format(prefix, service),
            alarm_name=f"{name}-twistlock-api-down",
            alarm_description=(
                "Twistlock API health check failed: one or more probed endpoints "
                "were down or too slow, or the health check Lambda did not run."
            ),
            metric=metric,
            threshold=1,
            comparison_operator=cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
            evaluation_periods=1,
            datapoints_to_alarm=1,
            treat_missing_data=cloudwatch.TreatMissingData.BREACHING,
        )
        alarm.add_alarm_action(cw_actions.SnsAction(topic))
        alarm.add_ok_action(cw_actions.SnsAction(topic))
