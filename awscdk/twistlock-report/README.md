
# Welcome to your CDK Python project!

## Scheduled CVE reports

The weekday CVE report publishes a separate SNS message for each repository
with recipients in `config/cve_report.json`. Set the email addresses in that
repository's `repos` array; an empty array disables its report. After deploying
the CDK stack, each address must confirm the SNS subscription for each
repository before it can receive reports. Changing or removing recipients
updates the subscriptions on the next deployment.

The `schedule` is an EventBridge expression in UTC. The report Lambda needs
network access from its VPC to RDS, Secrets Manager, and SNS (through NAT or
appropriate VPC endpoints). Large messages are sent in numbered parts to stay
under the SNS size limit. SNS publishes can succeed even when a subscription is still
unconfirmed, so check the SNS subscription status if reports do not arrive.

This is a blank project for CDK development with Python.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

This project is set up like a standard Python project.  The initialization
process also creates a virtualenv within this project, stored under the `.venv`
directory.  To create the virtualenv it assumes that there is a `python3`
(or `python` for Windows) executable in your path with access to the `venv`
package. If for any reason the automatic creation of the virtualenv fails,
you can create the virtualenv manually.

To manually create a virtualenv on MacOS and Linux:

```
$ python3 -m venv .venv
```

After the init process completes and the virtualenv is created, you can use the following
step to activate your virtualenv.

```
$ source .venv/bin/activate
```

If you are a Windows platform, you would activate the virtualenv like this:

```
% .venv\Scripts\activate.bat
```

Once the virtualenv is activated, you can install the required dependencies.

```
$ pip install -r requirements.txt
```

At this point you can now synthesize the CloudFormation template for this code.

```
$ cdk synth
```

To add additional dependencies, for example other CDK libraries, just add
them to your `setup.py` file and rerun the `pip install -r requirements.txt`
command.

## Useful commands

 * `cdk ls`          list all stacks in the app
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk docs`        open CDK documentation

Enjoy!
