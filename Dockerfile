FROM node:10-alpine as build-step
RUN mkdir -p /dive
WORKDIR /dive
COPY package*.json /dive/
RUN npm install
COPY . /dive/
RUN npm run build --prod

FROM nginx:1.17.1-alpine
COPY --from=build-step /dive/dist /usr/share/nginx/html
EXPOSE 56570
CMD ["/bin/sh", "-c", "sed -i 's/listen  .*/listen 56570;/g' /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
