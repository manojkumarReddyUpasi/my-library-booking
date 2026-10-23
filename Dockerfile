FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:stable-alpine
ENV NGINX_ENVSUBST_FILTER=BACKEND_URL

COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/my-library-booking/browser /usr/share/nginx/html

EXPOSE 8080
