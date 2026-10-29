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
`Jenkinsfile`; configure its SCM branch as `*/main`. Add a Jenkins username and
password credential with ID `aws-deploy-credentials`, using the AWS access key
as the username and secret key as the password. Keep those values in Jenkins
Credentials, never in the repository or Jenkinsfile. The AWS principal needs
`elasticbeanstalk:CreateStorageLocation`, `DescribeEnvironments`,
`CreateApplicationVersion`, and `UpdateEnvironment`, plus `s3:PutObject` and
`s3:GetObject` for the `library-booking/*` prefix in the regional Elastic
Beanstalk source bucket. Scope permissions to those environments and objects
where AWS supports resource-level permissions.

For Jenkins running in a local Ubuntu VM on Windows, configure the job's
**Poll SCM** trigger (for example, `H/5 * * * *`) so it can discover changes
from GitHub without requiring GitHub to reach your local machine. Keep the VM
running for polling and builds to occur. The AWS credential is required because
a local VM does not inherit an EC2 instance role.

The deploy stage runs only after all preceding stages succeed and only for the
`main` branch. It updates `library-booking-api` first and
`library-booking-web` second in `ap-southeast-2`; each deployment must return
Elastic Beanstalk status `Ready` and health `Green` for the Jenkins build to
pass. In the Elastic Beanstalk console, the previous application version can
be selected to roll back a deployment. Confirm that the Jenkins AWS principal
can upload to the region's Elastic Beanstalk source bucket and that both
environments use the Docker platform before enabling automatic deployment.

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
