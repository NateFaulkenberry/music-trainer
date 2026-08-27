FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*
COPY . .
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f ./nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
