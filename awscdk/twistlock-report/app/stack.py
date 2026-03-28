import boto3
from configparser import ConfigParser
from constructs import Construct
from cdk_ec2_key_pair import KeyPair, PublicKeyFormat
from aws_cdk import Stack
from aws_cdk import RemovalPolicy
from aws_cdk import SecretValue
from aws_cdk import aws_elasticloadbalancingv2 as elbv2
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_ecs as ecs
from aws_cdk import aws_opensearchservice as opensearch
from aws_cdk import aws_kms as kms
from aws_cdk import aws_secretsmanager as secretsmanager
from aws_cdk import aws_certificatemanager as acm
from aws_cdk import aws_rds as rds
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_ssm as ssm
from aws_cdk import aws_iam as iam
from aws_cdk import aws_efs as efs
from aws_cdk import Duration
from aws_cdk import RemovalPolicy
from services import frontend
import aws_cdk as cdk

class Stack(Stack):
    def __init__(self, scope: Construct, **kwargs) -> None:
        super().__init__(scope, **kwargs)

        ### Read config
        config = ConfigParser()
        config.read('config.ini')
        
        self.namingPrefix = "{}-{}".format(config['main']['resource_prefix'], config['main']['tier'])

        if config.has_option('main', 'subdomain'):
            self.app_url = "https://{}.{}".format(config['main']['subdomain'], config['main']['domain'])
        else:
            self.app_url = "https://{}".format(config['main']['domain'])
        
        ### Import VPC
        self.VPC = ec2.Vpc.from_lookup(self, "VPC",
            vpc_id = config['main']['vpc_id']
        )

        
        ### ALB
        # Extract subnet IDs
        #subnet1 = config.get('Subnets', 'subnet1')
        #subnet2 = config.get('Subnets', 'subnet2')
        #selected_subnets = ec2.SubnetSelection(
            #subnets=[
                #ec2.Subnet.from_subnet_id(self, "Subnet1", subnet1),
                #ec2.Subnet.from_subnet_id(self, "Subnet2", subnet2)
            #]
        #)
        self.ALB = elbv2.ApplicationLoadBalancer(self,
            "alb",
            load_balancer_name = f"{config['main']['resource_prefix']}-{config['main']['tier']}-alb",
            vpc=self.VPC,
            internet_facing=config.getboolean('alb', 'internet_facing'),
            #vpc_subnets=selected_subnets,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
        )

        self.ALB.add_redirect(
            source_protocol=elbv2.ApplicationProtocol.HTTP,
            source_port=80,
            target_protocol=elbv2.ApplicationProtocol.HTTPS,
            target_port=443)

        # Get certificate ARN for specified domain name
        
        cert_arn = config['alb']['certificate_arn']
        alb_cert = acm.Certificate.from_certificate_arn(self, "alb-cert",
            certificate_arn=cert_arn)

        self.listener = self.ALB.add_listener("PublicListener",
            certificates=[
                alb_cert
            ],
            port=443)

        ### ALB Access log
        log_bucket = s3.Bucket.from_bucket_name(self, "AlbAccessLogsBucket", config['main']['alb_log_bucket_name'])
        log_prefix = f"{config['main']['program']}/{config['main']['tier']}/{config['main']['resource_prefix']}/alb-access-logs"
 
        self.ALB.log_access_logs(
            bucket=log_bucket,
            prefix=log_prefix
#            bucket=self.alb_logs_bucket,
#            prefix="alb-logs/"
        )

        # Add a fixed error message when browsing an invalid URL
        #self.listener.add_action("ECS-Content-Not-Found",
            #action=elbv2.ListenerAction.fixed_response(200,
                #message_body="The requested resource is not available"))

        ### ECS Cluster
        self.kmsKey = kms.Key(self, "ECSExecKey")

        self.ECSCluster = ecs.Cluster(self,
            "ecs",
            cluster_name = f"{config['main']['resource_prefix']}-{config['main']['tier']}-ecs",
            vpc=self.VPC,
            execute_command_configuration=ecs.ExecuteCommandConfiguration(
                kms_key=self.kmsKey
            ),
        )
        
        # Frontend Service
        frontend.frontendService.createService(self, config)

        # Backend Service
        #backend.backendService.createService(self, config,[app_security_group])


        # Add a fixed error message when browsing an invalid URL
        self.listener.add_action("ECS-Content-Not-Found",
            action=elbv2.ListenerAction.fixed_response(200,
                message_body="The requested resource is not available"))
