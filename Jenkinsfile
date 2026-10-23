pipeline {
    agent any

    options {
        timestamps()
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

        stage('Build frontend') {
            steps {
                sh 'npm ci'
                sh 'npm run build'
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
                    ./mvnw -B test
                '''
            }
        }

        stage('Build Docker images') {
            steps {
                sh 'docker build --tag library-booking-frontend:${BUILD_NUMBER} .'
                sh 'docker build --tag library-booking-backend:${BUILD_NUMBER} backend'
            }
        }
    }
}
