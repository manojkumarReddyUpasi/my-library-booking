# Beginner deployment guide

This setup uses Docker, Jenkins, and two AWS Elastic Beanstalk environments:
one for the Spring Boot API and one for the Angular site. Kubernetes is not
needed for this first deployment.

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
It does not push images or deploy to AWS yet; those steps need your AWS region,
Elastic Beanstalk environment names, and Jenkins AWS credentials.

Use a Linux Jenkins agent with Git, Node.js 22, Java 17, Docker Engine access,
and OpenSSL installed. Create a Pipeline job using this Angular repository and
its `Jenkinsfile`. Install the Jenkins Pipeline and Git plugins. The agent user
must be allowed to access Docker.

## AWS Elastic Beanstalk deployment

The AWS CLI deployment uses the Sydney region (`ap-southeast-2`), a private
RDS MySQL instance, and separate single-instance Docker environments for the
API and Angular site. The API and frontend environments use `t3.micro` EC2
instances. A single-instance environment avoids a load balancer, but still
incurs EC2, storage, RDS, and data-transfer charges.

Authenticate the CLI with the AWS console session and check the environment
states with:

```powershell
aws login --region ap-southeast-2
aws sts get-caller-identity --region ap-southeast-2
aws elasticbeanstalk describe-environments `
  --environment-names library-booking-api library-booking-web `
  --region ap-southeast-2 `
  --query "Environments[].{Name:EnvironmentName,Status:Status,Health:Health,URL:CNAME}" `
  --output table
```

RDS remains private. Its security group should permit MySQL port 3306 only
from the API environment's EC2 security group. Do not add a public CIDR rule
for the database. The deployment's EC2 roles are separate: only the API role
can read the two secure SSM parameters used for `SPRING_DATASOURCE_PASSWORD`
and `JWT_SECRET`.

The Elastic Beanstalk URLs use HTTP in this temporary demo configuration.
Do not enter real or reused passwords, or use real user data, until HTTPS has
been configured with a domain and certificate. The API currently connects
using the RDS master account; create a restricted application database user
before using this setup for production.

The frontend calls the API through the same-origin `/backend/` path. Nginx in
the frontend container forwards that path to `BACKEND_URL`, so browser CORS
configuration is not needed for the deployed frontend.

## Deploying from Jenkins

The included pipeline remains CI-only: it builds and tests the apps and Docker
images, but does not deploy them. AWS CLI authentication on a developer
machine does not authenticate a separate Jenkins server. Add a deployment
stage only after configuring a narrowly scoped Jenkins AWS role or short-lived
credentials, plus artifact retention and a rollback procedure. Never add AWS
keys to this repository.
