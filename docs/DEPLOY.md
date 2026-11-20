# Deploying Okidoc on a Linux server (Docker)

This runs the **API**, the **website / clinic console / admin portal**, and **PostgreSQL** on one Linux server with Docker Compose. The mobile app is not deployed here: build it separately and point it at the API address.

| Container | What it runs | Port (inside) |
|---|---|---|
| `db` | PostgreSQL 17 (data in the `pgdata` volume) | 5432, not published |
| `api` | NestJS API + live queue (socket.io); applies database migrations on start | 4000 |
| `web` | Next.js landing page, clinic console and admin portal | 3000 |

Uploaded files (clinic photos, records) are kept in the `uploads` volume.

## 1. Server requirements

- A 64-bit Linux server (x86-64 or ARM64) with at least 2 GB RAM and 10 GB of free disk space. Building the images needs about 4 GB of RAM; if the server has less, build them on another machine (see section 7).
- Docker Engine 24+ with the Compose plugin (`docker compose version`).
- Internet access during the build, to download npm packages and Prisma's database engines.
- Two DNS names pointing at the server, for example `okidoc.example.in` (website) and `api.example.in` (API).

## 2. Get the code onto the server

Clone the repository from the company's internal git server (Azure DevOps on `*.amat.com`). Do not use GitHub, GitLab or Bitbucket.

```sh
git clone <internal repo URL> okidoc && cd okidoc
```

## 3. Configure

```sh
cp .env.docker.example .env
chmod 600 .env
openssl rand -hex 32   # run 3 times: POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_SETUP_SECRET
nano .env
```

Fill in at least:

- `PUBLIC_API_URL` and `PUBLIC_BASE_URL`: the public API address, for example `https://api.example.in`.
- `CORS_ORIGINS`: the website address, for example `https://okidoc.example.in`.
- `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET` and `JWT_SETUP_SECRET`. The API will not start while these are still `change-me`.
- `ADMIN_PHONE` and `ADMIN_PASSWORD` (at least 10 characters), for the first super-admin account.
- `SMS_PROVIDER=msg91` with the MSG91 keys, before real users sign up. With `console`, sign-up and login OTPs appear only in the API log.

## 4. Build and start

```sh
docker compose up -d --build
docker compose ps                 # all three should become "healthy"
docker compose logs -f api        # look for "Okidoc API on …"
```

The API applies any pending database migrations each time it starts.

## 5. First-time data (run once)

This loads the areas, specialties, plans and platform settings, and creates the super-admin from `ADMIN_PHONE` / `ADMIN_PASSWORD`:

```sh
docker compose run --rm api node prisma/dist/seed.js
```

It is safe to run again. With `SEED_DEMO=false` (the default in `.env.docker.example`), no demo accounts are created. Set `SEED_DEMO=true` only for a demo or test server: it adds demo clinics, doctors and patients with publicly known passwords.

Admin login needs an OTP. Until a real SMS provider is set, find the code in `docker compose logs api`.

## 6. HTTPS (reverse proxy)

The containers listen only on `127.0.0.1` by default. Put a reverse proxy in front for HTTPS. The API proxy must allow WebSocket upgrades, because the live queue uses socket.io.

Example with **Caddy** (fetches certificates automatically). `/etc/caddy/Caddyfile`:

```
okidoc.example.in {
    reverse_proxy 127.0.0.1:3000
}
api.example.in {
    reverse_proxy 127.0.0.1:4000
}
```

Example with **nginx** (certificates from certbot):

```nginx
server {
    server_name api.example.in;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 1h;
    }
    # listen 443 ssl; ssl_certificate … (added by certbot)
}
server {
    server_name okidoc.example.in;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

For a quick test without a domain, on a private network only: set `API_BIND=0.0.0.0`, `WEB_BIND=0.0.0.0` and `PUBLIC_API_URL=http://<server-ip>:4000` (also `CORS_ORIGINS=http://<server-ip>:3000`), then run `docker compose up -d --build`.

## 7. Updating

```sh
git pull
docker compose up -d --build      # new images; the API migrates the database on start
docker image prune -f
```

`PUBLIC_API_URL` is built into the web image. After changing it, rebuild the web image: `docker compose build web && docker compose up -d web`.

To build on another machine instead (for a small server), build and save the images there, then load them on the server:

```sh
docker compose build                                   # with the same .env
docker save okidoc-api okidoc-web | gzip > okidoc-images.tgz
# copy to the server, then:
gunzip -c okidoc-images.tgz | docker load && docker compose up -d --no-build
```

## 8. Backups

```sh
# Database
docker compose exec -T db pg_dump -U okidoc -Fc okidoc > okidoc-$(date +%F).dump
# Restore into an empty database:
docker compose exec -T db pg_restore -U okidoc -d okidoc --clean < okidoc-YYYY-MM-DD.dump

# Uploaded files
docker run --rm -v okidoc_uploads:/data -v "$PWD":/backup debian:bookworm-slim tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

Schedule both (for example with cron) and keep copies off the server.

## 9. Useful commands

```sh
docker compose logs -f api web          # logs
docker compose restart api              # restart one service
docker compose exec db psql -U okidoc   # database shell
docker compose down                     # stop (data volumes are kept)
```

`docker compose down -v` also deletes the database and uploads volumes. Do not run it on a live server.

## Notes

- Run only one `api` container, unless you set `JOBS_ENABLED=false` on all but one and `MIGRATE_ON_START=false` on the extra containers. More than one container also needs Redis for socket.io fan-out, which is not set up yet.
- Payments stay simulated (`PAYMENT_GATEWAY=mock`) until Razorpay keys are configured.
- Times are Indian Standard Time (`TZ=Asia/Kolkata` in all containers).
