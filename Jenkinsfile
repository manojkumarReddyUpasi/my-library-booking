pipeline {
    agent {
        label 'ubuntu-docker'
    }

    options {
        skipDefaultCheckout(true)
        timestamps()
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    environment {
        AWS_REGION = 'ap-southeast-2'
        EB_API_ENVIRONMENT = 'library-booking-api'
        EB_WEB_ENVIRONMENT = 'library-booking-web'
    }

    stages {
        stage('Checkout frontend') {
            steps {
                retry(3) {
                    script {
                        def checkoutVars = checkout scm
                        env.SCM_BRANCH = checkoutVars.GIT_BRANCH ?: ''
                        echo "Frontend SCM branch: ${env.SCM_BRANCH}"
                    }
                }
            }
        }

        stage('Checkout backend') {
            steps {
                dir('backend') {
                    git branch: 'main',
                        url: 'https://github.com/manojkumarReddyUpasi/llibrary-booking-backend.git'
                }
            }
        }

        stage('Install Node.js') {
            steps {
                sh '''
                    set -eu
                    NODE_VERSION=22.22.3
                    NODE_ARCHIVE="node-v${NODE_VERSION}-linux-x64.tar.xz"
                    NODE_DIR="$WORKSPACE/.ci-tools"
                    mkdir -p "$NODE_DIR"
                    curl --fail --location --silent --show-error \
                      "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}" \
                      --output "$NODE_DIR/$NODE_ARCHIVE"
                    curl --fail --location --silent --show-error \
                      "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" \
                      --output "$NODE_DIR/SHASUMS256.txt"
                    if ! CHECKSUM_LINE="$(grep -E "  ${NODE_ARCHIVE}$" "$NODE_DIR/SHASUMS256.txt")"; then
                      echo "Could not find the Node.js archive checksum."
                      exit 1
                    fi
                    printf '%s\\n' "$CHECKSUM_LINE" | (
                      cd "$NODE_DIR"
                      sha256sum --check --status
                    )
                    tar -xJf "$NODE_DIR/$NODE_ARCHIVE" -C "$NODE_DIR"
                '''
            }
        }

        stage('Build frontend') {
            steps {
                withEnv(["PATH+NODEJS=${env.WORKSPACE}/.ci-tools/node-v22.22.3-linux-x64/bin"]) {
                    sh 'node --version'
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }

        stage('Test backend') {
            steps {
                sh '''
                    set -eu
                    DB_CONTAINER="library-booking-ci-db-${BUILD_NUMBER}"
                    cleanup() {
                      docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
                    }
                    trap cleanup EXIT

                    docker run --detach --rm \
                      --name "$DB_CONTAINER" \
                      --env MYSQL_ROOT_PASSWORD=ci-root-password \
                      --env MYSQL_DATABASE=library_booking \
                      --publish 127.0.0.1::3306 \
                      mysql:8.4

                    DB_PORT="$(docker port "$DB_CONTAINER" 3306/tcp | awk -F: '{print $NF}')"
                    READY=0
                    for attempt in $(seq 1 60); do
                      if docker exec "$DB_CONTAINER" \
                        mysqladmin ping --host=127.0.0.1 --user=root \
                        --password=ci-root-password --silent >/dev/null 2>&1; then
                        READY=1
                        break
                      fi
                      sleep 2
                    done
                    if [ "$READY" -ne 1 ]; then
                      docker logs "$DB_CONTAINER"
                      exit 1
                    fi

                    cd backend
                    SPRING_DATASOURCE_URL="jdbc:mysql://127.0.0.1:${DB_PORT}/library_booking?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC" \
                    SPRING_DATASOURCE_USERNAME=root \
                    SPRING_DATASOURCE_PASSWORD=ci-root-password \
                    JWT_SECRET="$(openssl rand -base64 32)" \
                    sh ./mvnw -B test
                '''
            }
        }

        stage('Build Docker images') {
            steps {
                sh 'docker build --tag library-booking-frontend:${BUILD_NUMBER} .'
                sh 'docker build --tag library-booking-backend:${BUILD_NUMBER} backend'
            }
        }

        stage('Run locally') {
            steps {
                sh '''
                    set -eu
                    set +x
                    NETWORK=library-booking-local
                    DB_CONTAINER=library-booking-local-db
                    API_CONTAINER=library-booking-local-api
                    WEB_CONTAINER=library-booking-local-web
                    CONFIG_DIR="$HOME/.config/my-library-booking-local"
                    ENV_FILE="$CONFIG_DIR/backend.env"

                    mkdir -p "$CONFIG_DIR"
                    chmod 700 "$CONFIG_DIR"
                    if [ ! -s "$ENV_FILE" ]; then
                      umask 077
                      DB_PASSWORD="$(openssl rand -hex 32)"
                      JWT_SECRET="$(openssl rand -base64 48)"
                      printf 'MYSQL_ROOT_PASSWORD=%s\\nSPRING_DATASOURCE_PASSWORD=%s\\nJWT_SECRET=%s\\n' \
                        "$DB_PASSWORD" "$DB_PASSWORD" "$JWT_SECRET" > "$ENV_FILE"
                      unset DB_PASSWORD JWT_SECRET
                    fi
                    chmod 600 "$ENV_FILE"
                    if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
                      docker network create "$NETWORK" >/dev/null
                    fi

                    if docker container inspect "$DB_CONTAINER" >/dev/null 2>&1; then
                      DB_CONTAINER_ENV="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_CONTAINER")"
                      DB_PASSWORD_COUNT="$(printf '%s\\n' "$DB_CONTAINER_ENV" | grep -c '^MYSQL_ROOT_PASSWORD=' || true)"
                      DB_PASSWORD="$(printf '%s\\n' "$DB_CONTAINER_ENV" | sed -n 's/^MYSQL_ROOT_PASSWORD=//p')"
                      unset DB_CONTAINER_ENV
                      if [ "$DB_PASSWORD_COUNT" -ne 1 ] || [ -z "$DB_PASSWORD" ]; then
                        echo "Could not recover the configured MySQL root password from $DB_CONTAINER."
                        exit 1
                      fi
                      unset DB_PASSWORD_COUNT
                    else
                      DB_PASSWORD_COUNT="$(grep -c '^MYSQL_ROOT_PASSWORD=' "$ENV_FILE" || true)"
                      DB_PASSWORD="$(sed -n 's/^MYSQL_ROOT_PASSWORD=//p' "$ENV_FILE")"
                      if [ "$DB_PASSWORD_COUNT" -ne 1 ] || [ -z "$DB_PASSWORD" ]; then
                        echo "Expected exactly one non-empty MYSQL_ROOT_PASSWORD in $ENV_FILE."
                        exit 1
                      fi
                      unset DB_PASSWORD_COUNT
                    fi

                    FILE_DB_PASSWORD="$(sed -n 's/^MYSQL_ROOT_PASSWORD=//p' "$ENV_FILE")"
                    SPRING_PASSWORD="$(sed -n 's/^SPRING_DATASOURCE_PASSWORD=//p' "$ENV_FILE")"
                    SPRING_PASSWORD_COUNT="$(grep -c '^SPRING_DATASOURCE_PASSWORD=' "$ENV_FILE" || true)"
                    if [ "$DB_PASSWORD" != "$FILE_DB_PASSWORD" ] || \
                      [ "$DB_PASSWORD" != "$SPRING_PASSWORD" ] || \
                      [ "$SPRING_PASSWORD_COUNT" -ne 1 ]; then
                      umask 077
                      awk '!/^(MYSQL_ROOT_PASSWORD|SPRING_DATASOURCE_PASSWORD)=/' "$ENV_FILE" > "$ENV_FILE.tmp"
                      printf 'MYSQL_ROOT_PASSWORD=%s\\nSPRING_DATASOURCE_PASSWORD=%s\\n' \
                        "$DB_PASSWORD" "$DB_PASSWORD" >> "$ENV_FILE.tmp"
                      mv "$ENV_FILE.tmp" "$ENV_FILE"
                      chmod 600 "$ENV_FILE"
                    fi
                    unset FILE_DB_PASSWORD SPRING_PASSWORD SPRING_PASSWORD_COUNT

                    if ! docker container inspect "$DB_CONTAINER" >/dev/null 2>&1; then
                      docker volume create library-booking-local-db-data >/dev/null
                      docker run --detach \
                        --name "$DB_CONTAINER" \
                        --restart unless-stopped \
                        --network "$NETWORK" \
                        --network-alias database \
                        --mount source=library-booking-local-db-data,target=/var/lib/mysql \
                        --env-file "$ENV_FILE" \
                        --env MYSQL_DATABASE=library_booking \
                        mysql:8.4
                    else
                      docker start "$DB_CONTAINER" >/dev/null
                    fi

                    READY=0
                    for attempt in $(seq 1 60); do
                      if docker exec "$DB_CONTAINER" sh -c \
                        'mysqladmin ping --host=127.0.0.1 --user=root --password="$MYSQL_ROOT_PASSWORD" --silent' \
                        >/dev/null 2>&1; then
                        READY=1
                        break
                      fi
                      sleep 2
                    done
                    if [ "$READY" -ne 1 ]; then
                      docker logs "$DB_CONTAINER"
                      echo "Local MySQL did not become ready."
                      exit 1
                    fi
                    if ! docker exec "$DB_CONTAINER" sh -c \
                      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --host=127.0.0.1 --user=root --batch --skip-column-names --execute="SELECT 1"' \
                      >/dev/null 2>&1; then
                      echo "Local MySQL is running, but its configured root password does not authenticate."
                      exit 1
                    fi

                    for port in 4200 8081; do
                      for container in $(docker ps --quiet --filter "publish=$port"); do
                        name="$(docker inspect --format '{{.Name}}' "$container" | sed 's#^/##')"
                        case "$port:$name" in
                          4200:library-booking-local-web|8081:library-booking-local-api)
                            ;;
                          *)
                            echo "Local port $port is already used by Docker container $name."
                            exit 1
                            ;;
                        esac
                      done
                    done

                    docker rm --force "$WEB_CONTAINER" "$API_CONTAINER" >/dev/null 2>&1 || true
                    docker run --detach \
                      --name "$API_CONTAINER" \
                      --restart unless-stopped \
                      --network "$NETWORK" \
                      --network-alias backend \
                      --publish 127.0.0.1:8081:8081 \
                      --env-file "$ENV_FILE" \
                      --env SPRING_DATASOURCE_URL='jdbc:mysql://database:3306/library_booking?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC' \
                      --env SPRING_DATASOURCE_USERNAME=root \
                      "library-booking-backend:${BUILD_NUMBER}" >/dev/null

                    if ! docker run --detach \
                      --name "$WEB_CONTAINER" \
                      --restart unless-stopped \
                      --network "$NETWORK" \
                      --publish 127.0.0.1:4200:8080 \
                      --env BACKEND_URL=http://backend:8081 \
                      "library-booking-frontend:${BUILD_NUMBER}" >/dev/null; then
                      docker rm --force "$API_CONTAINER" >/dev/null 2>&1 || true
                      exit 1
                    fi

                    API_READY=0
                    for attempt in $(seq 1 60); do
                      API_STATUS="$(curl --connect-timeout 2 --max-time 5 \
                        --silent --output /dev/null --write-out '%{http_code}' \
                        http://127.0.0.1:8081/ || true)"
                      case "$API_STATUS" in
                        2??|3??|4??) API_READY=1; break ;;
                      esac
                      sleep 2
                    done
                    if [ "$API_READY" -ne 1 ]; then
                      docker logs "$API_CONTAINER"
                      docker rm --force "$WEB_CONTAINER" "$API_CONTAINER" >/dev/null 2>&1 || true
                      echo "Local backend did not become ready."
                      exit 1
                    fi

                    WEB_READY=0
                    for attempt in $(seq 1 30); do
                      WEB_STATUS="$(curl --connect-timeout 2 --max-time 5 \
                        --silent --output /dev/null --write-out '%{http_code}' \
                        http://127.0.0.1:4200/ || true)"
                      if [ "$WEB_STATUS" = 200 ]; then
                        WEB_READY=1
                        break
                      fi
                      sleep 2
                    done
                    if [ "$WEB_READY" -ne 1 ]; then
                      docker logs "$WEB_CONTAINER"
                      docker rm --force "$WEB_CONTAINER" "$API_CONTAINER" >/dev/null 2>&1 || true
                      echo "Local frontend did not return HTTP 200."
                      exit 1
                    fi

                    echo "Build ${BUILD_NUMBER} is running locally at http://localhost:4200"
                    echo "Backend: http://localhost:8081 (HTTP ${API_STATUS})"
                    echo "Containers remain running after this Jenkins build and are replaced by the next successful build."
                '''
            }
        }

        stage('Deploy to AWS') {
            when {
                expression {
                    def branch = env.SCM_BRANCH ?: env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    branch = branch.replaceFirst('^refs/remotes/', '').replaceFirst('^refs/heads/', '')
                    branch == 'main' || branch == 'origin/main'
                }
            }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'eacef078-cc1c-4734-a1f2-fb4665f0236f',
                    usernameVariable: 'AWS_ACCESS_KEY_ID',
                    passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                )]) {
                    sh '''
                        set -eu
                        VERSION_LABEL="${BUILD_NUMBER}-$(git rev-parse --short=7 HEAD)"
                        BUNDLE_DIR="deploy-bundles"
                        mkdir -p "$BUNDLE_DIR"

                        FRONTEND_BUNDLE_DIR="$BUNDLE_DIR/frontend"
                        mkdir -p "$FRONTEND_BUNDLE_DIR"
                        git archive --format=tar HEAD \
                          ':(exclude)docker-compose.yml' | tar -xf - -C "$FRONTEND_BUNDLE_DIR"
                        mkdir -p "$FRONTEND_BUNDLE_DIR/dist/my-library-booking"
                        cp -R dist/my-library-booking/browser \
                          "$FRONTEND_BUNDLE_DIR/dist/my-library-booking/browser"
                        printf '%s\n' \
                          'FROM nginx:stable-alpine' \
                          'COPY docker/default.conf.template /etc/nginx/templates/default.conf.template' \
                          'COPY dist/my-library-booking/browser /usr/share/nginx/html' \
                          'EXPOSE 8080' \
                          > "$FRONTEND_BUNDLE_DIR/Dockerfile"
                        jar --create --file="$BUNDLE_DIR/frontend.zip" \
                          -C "$FRONTEND_BUNDLE_DIR" .
                        git -C backend archive --format=zip \
                          --output="../$BUNDLE_DIR/backend.zip" HEAD

                        BUCKET="$(aws elasticbeanstalk create-storage-location \
                          --region "$AWS_REGION" \
                          --query S3Bucket --output text)"
                        if [ -z "$BUCKET" ] || [ "$BUCKET" = "None" ]; then
                          echo "Could not determine the Elastic Beanstalk source bucket."
                          exit 1
                        fi

                        deploy_environment() {
                          environment_name="$1"
                          artifact="$2"
                          application_name="$(aws elasticbeanstalk describe-environments \
                            --region "$AWS_REGION" \
                            --environment-names "$environment_name" \
                            --query 'Environments[0].ApplicationName' --output text)"
                          environment_status="$(aws elasticbeanstalk describe-environments \
                            --region "$AWS_REGION" \
                            --environment-names "$environment_name" \
                            --query 'Environments[0].Status' --output text)"

                          if [ -z "$application_name" ] || [ "$application_name" = "None" ]; then
                            echo "Elastic Beanstalk environment not found: $environment_name"
                            exit 1
                          fi
                          if [ "$environment_status" != "Ready" ]; then
                            echo "Environment $environment_name is not Ready (status: $environment_status)."
                            exit 1
                          fi

                          object_key="library-booking/$environment_name/$VERSION_LABEL.zip"
                          aws s3 cp "$artifact" "s3://$BUCKET/$object_key" \
                            --region "$AWS_REGION" \
                            --acl bucket-owner-full-control \
                            --only-show-errors
                          aws elasticbeanstalk create-application-version \
                            --region "$AWS_REGION" \
                            --application-name "$application_name" \
                            --version-label "$VERSION_LABEL" \
                            --source-bundle "S3Bucket=$BUCKET,S3Key=$object_key" \
                            --description "Jenkins build $BUILD_NUMBER"
                          aws elasticbeanstalk update-environment \
                            --region "$AWS_REGION" \
                            --environment-name "$environment_name" \
                            --option-settings "Namespace=aws:elasticbeanstalk:environment:process:default,OptionName=HealthCheckPath,Value=$([ "$environment_name" = "$EB_API_ENVIRONMENT" ] && printf '/health' || printf '/')" \
                            --version-label "$VERSION_LABEL"
                          aws elasticbeanstalk wait environment-updated \
                            --region "$AWS_REGION" \
                            --environment-names "$environment_name"

                          final_status="$(aws elasticbeanstalk describe-environments \
                            --region "$AWS_REGION" \
                            --environment-names "$environment_name" \
                            --query 'Environments[0].Status' --output text)"
                          final_health="$(aws elasticbeanstalk describe-environments \
                            --region "$AWS_REGION" \
                            --environment-names "$environment_name" \
                            --query 'Environments[0].Health' --output text)"
                          if [ "$final_status" != "Ready" ] || [ "$final_health" != "Green" ]; then
                            echo "Deployment to $environment_name finished with status=$final_status health=$final_health."
                            aws elasticbeanstalk describe-events \
                              --region "$AWS_REGION" \
                              --environment-name "$environment_name" \
                              --max-items 10 \
                              --query 'Events[].{Time:EventDate,Severity:Severity,Message:Message}' \
                              --output table || true
                            exit 1
                          fi
                          echo "Deployed $VERSION_LABEL to $environment_name (health: $final_health)."
                        }

                        deploy_environment "$EB_API_ENVIRONMENT" "$BUNDLE_DIR/backend.zip"
                        deploy_environment "$EB_WEB_ENVIRONMENT" "$BUNDLE_DIR/frontend.zip"
                    '''
                }
            }
        }
    }
}
