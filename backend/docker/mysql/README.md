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

## Reset / Rebuild (clear data and re-init)

If you want to clear the current database and re-run `initdb/*.sql`, you must delete the MySQL data volume.

### Using docker compose (recommended)

From this folder:

```powershell
cd backend\docker\mysql

# Stop and remove container + network + the named volume defined in docker-compose.yml
docker compose down -v

# Start again (initdb scripts will run again)
docker compose up -d
```

### If you previously used `docker run`

If you started MySQL via `docker run -v medisage-mysql-data:/var/lib/mysql`, then the volume name is likely `medisage-mysql-data`.

```powershell
docker rm -f medisage-mysql
docker volume rm medisage-mysql-data
```

### Troubleshooting: find the actual volume name

Compose may prefix volume names (e.g. `mysql_medisage-mysql-data`). If you are not sure:

```powershell
docker volume ls
docker volume ls | Select-String medisage
```

Then remove the matching volume and run `docker compose up -d` again.

## Connect

```powershell
mysql -h 127.0.0.1 -P 3306 -u root -p
```
