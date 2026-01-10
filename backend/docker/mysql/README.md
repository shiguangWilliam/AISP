# MySQL (Docker)

This folder contains a simple MySQL image that auto-initializes the `medisage` database.

## Build

From repository root:

```powershell
cd backend\docker\mysql
docker build -t medisage-mysql:8.0 .

# If Docker Hub is slow/unreachable, build from a China mirror base image:
docker build -t medisage-mysql:8.0 --build-arg MYSQL_IMAGE=docker.m.daocloud.io/library/mysql:8.0 .

# Alternative mirrors (pick one that works for your network):
# docker build -t medisage-mysql:8.0 --build-arg MYSQL_IMAGE=registry.cn-hangzhou.aliyuncs.com/library/mysql:8.0 .
```

## Run

```powershell
docker run --name medisage-mysql \
  -e MYSQL_ROOT_PASSWORD=root123456 \
  -e MYSQL_DATABASE=medisage \
  -p 3306:3306 \
  -v medisage-mysql-data:/var/lib/mysql \
  medisage-mysql:8.0
```

## Run (recommended, no build)

If you just want to run MySQL using a mirror image, use docker compose:

```powershell
cd backend\\docker\\mysql
docker compose up -d
```

You can change the mirror image in `docker-compose.yml` if needed.

- The SQL in `initdb/` runs only on first startup (when the data volume is empty).
- If you need to re-run init scripts, remove the volume: `docker volume rm medisage-mysql-data`.

## Connect

```powershell
mysql -h 127.0.0.1 -P 3306 -u root -p
```
