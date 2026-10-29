# Beginner deployment guide

This setup uses Docker, Jenkins, and two AWS Elastic Beanstalk environments:
one for the Spring Boot API and one for the Angular site. The AWS resources are
defined in [`infra/aws-library-booking.yaml`](./infra/aws-library-booking.yaml),
and the Jenkins deployment permissions are defined in
[`infra/jenkins-deploy-policy.json`](./infra/jenkins-deploy-policy.json).
Kubernetes is not needed for this first deployment.

> AWS resources, including RDS and the two Elastic Beanstalk instances, can
> incur charges. The $1 budget is an alert, not a spending cap.
> Never put real passwords, database credentials, JWT keys, or AWS keys in Git.
> Database credentials and the JWT signing key are supplied through environment
> variables backed by encrypted SSM Parameter Store `SecureString` parameters.

## Run both apps locally with Docker Compose

Requirements: Docker Desktop with Docker Compose, and both Git repositories
cloned as sibling folders:

```text
.local/
  my-library-booking/
  library booking/
```

From the Angular folder in PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open `http://localhost:4200`. The app proxies API requests to the Spring
container; MySQL is available on port 3307. Compose creates a named volume so
the local database survives container restarts.

Stop the containers with `docker compose down`. To also permanently delete the
local database volume, run `docker compose down --volumes`.

For non-Docker Angular development, `npm start` uses `proxy.conf.json`; run the
Spring app separately on port 8081.

## Jenkins continuous integration

The `Jenkinsfile` checks out both repositories, builds Angular, runs the Spring
Boot tests against a temporary MySQL container, and builds both Docker images.
After successful image builds, it runs the images locally on the Jenkins WSL
worker at `http://localhost:4200`, with the API at `http://localhost:8081`.
Those containers stay up after the build and are replaced by the next
successful build. Their MySQL data is kept in a Docker volume. For an existing
local database container, Jenkins reuses its configured MySQL root password
and synchronizes the backend environment file to it; it verifies database
authentication before starting the API. Successful builds from `main` also
deploy to the Elastic Beanstalk API and web environments.
AWS deployment uses the repositories' Dockerfiles as Elastic Beanstalk source
bundles; it does not push images to a container registry.

Use a Linux Jenkins agent with Git, Node.js 22, Java 17, Docker Engine access,
the AWS CLI v2, and OpenSSL installed. The agent user must be allowed to access
Docker. Create a Pipeline job using this Angular repository and its
`Jenkinsfile`; configure its SCM branch as `*/main`. The Jenkinsfile polls SCM
every five minutes, so no separate Poll SCM trigger needs to be configured in
the job. Keep the Jenkins controller and agent online for polling and builds.
Configure the Jenkins username/password credential with ID
`eacef078-cc1c-4734-a1f2-fb4665f0236f`, using the dedicated deployment user's
AWS access key as the username and secret key as the password. The policy in
[`infra/jenkins-deploy-policy.json`](./infra/jenkins-deploy-policy.json) scopes
deployment to the two Elastic Beanstalk applications, their application
versions and environments, their CloudFormation metadata, and the deployment
artifact prefix. Keep the keys in Jenkins Credentials, never in the
repository, Jenkinsfile, or build log. Never use root-user access keys for
Jenkins.

For Jenkins running in a local Ubuntu VM on Windows, SCM polling lets it
discover GitHub changes without requiring GitHub to reach your local machine.
The AWS credential is required because a local VM does not inherit an EC2
instance role.

The deploy stage runs only after all preceding stages succeed and only for the
`main` branch. It updates `library-booking-api` first and
`library-booking-web` second in `ap-southeast-2`; each deployment must return
Elastic Beanstalk status `Ready` and health `Green` for the Jenkins build to
pass. In the Elastic Beanstalk console, the previous application version can
be selected to roll back a deployment. Confirm that the Jenkins AWS principal
can upload to the region's Elastic Beanstalk source bucket and that both
environments use the Docker platform before enabling automatic deployment.

## AWS Elastic Beanstalk deployment

The AWS deployment uses the Sydney region (`ap-southeast-2`), a non-public
RDS MySQL instance, and separate single-instance Docker environments for the
API and Angular site. The API and frontend environments use `t3.micro` EC2
instances. A single-instance environment avoids a load balancer, but still
incurs EC2, storage, RDS, and data-transfer charges. The database is in the
default VPC subnets with `PubliclyAccessible` disabled; its security group
allows MySQL only from the API instances. The API and web environments accept
public HTTP traffic, so configure HTTPS before using real user data.

Use a named AWS CLI profile for one-time account setup; do not overwrite the
default profile or create root access keys. Use the account's console sign-in
to authenticate the profile:

```powershell
aws login --profile library-booking-bootstrap --region ap-southeast-2
aws sts get-caller-identity --profile library-booking-bootstrap --region ap-southeast-2
aws elasticbeanstalk describe-environments `
  --environment-names library-booking-api library-booking-web `
  --profile library-booking-bootstrap `
  --region ap-southeast-2 `
  --query "Environments[].{Name:EnvironmentName,Status:Status,Health:Health,URL:CNAME}" `
  --output table
```

The stack creates the resources in
[`infra/aws-library-booking.yaml`](./infra/aws-library-booking.yaml). It
expects the database password and JWT signing key to exist as encrypted SSM
Standard `SecureString` parameters named
`/library-booking/database-password` and `/library-booking/jwt-secret`.
Provide the database password as the stack's protected `DatabasePassword`
parameter as well. Do not put either value in a command-line argument, source
file, or build log; use temporary local files and remove them after stack
creation. The API environment uses `SPRING_PROFILES_ACTIVE=aws` and resolves
the two parameters through Elastic Beanstalk's environment-secrets feature.
Only the API instance role can read them; the web role cannot.

The database username is `libraryapp`; the backend Liquibase migrations
initialize the schema on startup. The web environment's `BACKEND_URL` points
to the API environment, and Nginx forwards same-origin `/backend/` requests.
Deleting the CloudFormation stack creates a final database snapshot; delete
that snapshot separately when it is no longer needed to avoid ongoing snapshot
storage charges.

The Jenkins deployment identity is the dedicated IAM user
`library-booking-jenkins-deploy`. On a new account, create the user and attach
the deployment policy:

```powershell
$policyFile = (Resolve-Path '.\infra\jenkins-deploy-policy.json').Path
aws iam create-user --profile library-booking-bootstrap --user-name library-booking-jenkins-deploy
aws iam put-user-policy `
  --profile library-booking-bootstrap `
  --user-name library-booking-jenkins-deploy `
  --policy-name LibraryBookingDeployment `
  --policy-document "file://$policyFile"
```

The access key is stored in the existing Jenkins credential. AWS displays a
new secret access key only once; do not paste it into chat or save it in the
repository. For rotation, update Jenkins with the new key before deactivating
the old one. The bootstrap profile is for one-time setup only; Jenkins uses
the dedicated IAM user.

The Elastic Beanstalk URLs use HTTP in this temporary demo configuration.
Do not enter real or reused passwords, or use real user data, until HTTPS has
been configured with a domain and certificate. The API currently connects
using the RDS master account; create a restricted application database user
before using this setup for production.

The frontend calls the API through the same-origin `/backend/` path. Nginx in
the frontend container forwards that path to `BACKEND_URL`, so browser CORS
configuration is not needed for the deployed frontend.

## Deploying from Jenkins

After configuring Jenkins credentials and polling as described above, use
**Build Now** once to verify checkout, frontend build, backend tests, and Docker
image builds before relying on automatic polling. A successful image build
starts or updates the local app at `http://localhost:4200`; the Jenkins worker
must remain online for builds and local hosting to work. A successful `main`
build then deploys the API and web source bundles in order. Check the build's
**Console Output** for each environment's final `Ready` / `Green` status.

To stop the local test app from Ubuntu WSL, remove its named containers and
network:

```bash
docker rm -f library-booking-local-web library-booking-local-api library-booking-local-db
docker network rm library-booking-local
```

The database volume remains so its data survives a later restart. To also
permanently delete that local test data, run
`docker volume rm library-booking-local-db-data`.
Never add AWS keys or database credentials to this repository.
