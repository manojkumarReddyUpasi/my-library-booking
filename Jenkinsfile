pipeline {
    agent {
        label 'ubuntu-docker'
    }

    options {
        timestamps()
    }

    environment {
        AWS_REGION = 'ap-southeast-2'
        EB_API_ENVIRONMENT = 'library-booking-api'
        EB_WEB_ENVIRONMENT = 'library-booking-web'
    }

    stages {
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

        stage('Deploy to AWS') {
            when {
                expression {
                    def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
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

                        git archive --format=zip \
                          --output="$BUNDLE_DIR/frontend.zip" HEAD
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
                            --region "$AWS_REGION" --only-show-errors
                          aws elasticbeanstalk create-application-version \
                            --region "$AWS_REGION" \
                            --application-name "$application_name" \
                            --version-label "$VERSION_LABEL" \
                            --source-bundle "S3Bucket=$BUCKET,S3Key=$object_key" \
                            --description "Jenkins build $BUILD_NUMBER"
                          aws elasticbeanstalk update-environment \
                            --region "$AWS_REGION" \
                            --environment-name "$environment_name" \
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
