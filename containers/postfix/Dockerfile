FROM alpine
ENV DOCKERIZE_VERSION v0.6.1

# install packages
RUN apk add --no-cache --upgrade bash postfix postfix-pgsql

# install dockerize
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz

# copy postfix config file template into image
COPY main.cf.tmpl /etc/postfix/main.cf.tmpl
COPY pgsql-aliases.cf.tmpl /etc/postfix/pgsql-aliases.cf.tmpl
COPY pgsql-domains.cf.tmpl /etc/postfix/pgsql-domains.cf.tmpl

# postfix is listening on port 25
EXPOSE 25
EXPOSE 587

CMD dockerize -template /etc/postfix/main.cf.tmpl:/etc/postfix/main.cf -template /etc/postfix/pgsql-aliases.cf.tmpl:/etc/postfix/pgsql-aliases.cf -template /etc/postfix/pgsql-domains.cf.tmpl:/etc/postfix/pgsql-domains.cf postfix start-fg

