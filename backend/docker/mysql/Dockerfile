ARG MYSQL_IMAGE=docker.m.daocloud.io/library/mysql:8.0
FROM ${MYSQL_IMAGE}

# MySQL official image will execute *.sql/*.sh in this directory on first initialization
# (i.e. when /var/lib/mysql is empty).
COPY ./initdb/ /docker-entrypoint-initdb.d/
