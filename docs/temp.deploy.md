# Temporary deployment: Okidoc on 64.227.164.200 with HTTPS (sslip.io + nginx)

Use this until Okidoc has its own domain. It uses free sslip.io names, which need no registration. Any name that ends in 64-227-164-200.sslip.io points to the server's IP.

| What | Public address | Docker port (localhost only) |
|---|---|---|
| Website, clinic console, admin portal | https://app.64-227-164-200.sslip.io | 4600 |
| API (also used by the phone app) | https://api.64-227-164-200.sslip.io | 4700 |

Only nginx is public, on ports 80 and 443. Docker's ports 4600 and 4700 listen on 127.0.0.1 only.

---

## Step 1: Check the server

Log in to the server:

sh
ssh root@64.227.164.200


Confirm that the names resolve to the server. Each command should show 64.227.164.200:

sh
getent hosts app.64-227-164-200.sslip.io
getent hosts api.64-227-164-200.sslip.io


Make sure ports 80 and 443 are open. If you use a DigitalOcean Cloud Firewall, allow inbound TCP 22, 80 and 443 there. If ufw is active:

sh
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp


Make sure nothing else is using port 80 or 443. This should print nothing:

sh
sudo ss -tlnp | grep -E ':(80|443) '


---

## Step 2: Install Docker

Skip this step if docker compose version already works.

sh
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version


---

## Step 3: Put the code on the server

Do not use GitHub, GitLab or Bitbucket. Use one of these two options.

*Option A: clone from the internal git server*, if the server can reach it:

sh
git clone <internal *.amat.com repo URL> /opt/okidoc
cd /opt/okidoc


*Option B: copy from your PC.* On your Windows PC, in Git Bash, from the Okidoc folder:

sh
git archive --format=tar.gz -o okidoc.tgz HEAD
scp okidoc.tgz root@64.227.164.200:/opt/


Then on the server:

sh
mkdir -p /opt/okidoc && tar xzf /opt/okidoc.tgz -C /opt/okidoc && cd /opt/okidoc


git archive copies only committed files. Commit the Docker files first: Dockerfile, docker-compose.yml, .env.docker.example, .dockerignore, apps/api/docker-entrypoint.sh and .gitattributes.

---

## Step 4: Create the .env file

sh
cd /opt/okidoc
cp .env.docker.example .env
chmod 600 .env


Generate three secrets. Run this three times and copy each result:

sh
openssl rand -hex 32


Open the file with nano .env and set these values. Leave everything else as it is.

ini
# Public addresses
PUBLIC_API_URL=https://api.64-227-164-200.sslip.io
PUBLIC_BASE_URL=https://api.64-227-164-200.sslip.io
CORS_ORIGINS=https://app.64-227-164-200.sslip.io

# Docker ports: localhost only; nginx is in front
API_BIND=127.0.0.1
API_PORT=4700
WEB_BIND=127.0.0.1
WEB_PORT=4600

# Secrets: paste the three openssl values
POSTGRES_PASSWORD=<secret 1>
JWT_ACCESS_SECRET=<secret 2>
JWT_SETUP_SECRET=<secret 3>

# First super-admin (used by the seed in Step 6)
SEED_DEMO=false
ADMIN_PHONE=<your 10-digit mobile number>
ADMIN_PASSWORD=<at least 10 characters>
ADMIN_NAME=Okidoc Admin
ADMIN_EMAIL=<your email, optional>


To save and exit nano, press Ctrl+O, then Enter, then Ctrl+X.

---

## Step 5: Build and start Okidoc

sh
docker compose up -d --build


The first build takes about 5 to 15 minutes. When it finishes, check the containers:

sh
docker compose ps


After about a minute, db, api and web should all show healthy.

Check them locally on the server:

sh
curl -s http://127.0.0.1:4700/api/v1/health                        # {"ok":true,...}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4600/   # 200


If something is wrong, look at the logs:

sh
docker compose logs --tail=100 api
docker compose logs --tail=100 web


---

## Step 6: Load the first data (run once)

This loads the areas, specialties, plans and settings, and creates your super-admin from ADMIN_PHONE and ADMIN_PASSWORD:

sh
docker compose run --rm api node prisma/dist/seed.js


It should end with Seed complete (reference data + super-admin …).

---

## Step 7: Install nginx and certbot

sh
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx


---

## Step 8: Configure nginx

Create the site file:

sh
sudo nano /etc/nginx/sites-available/okidoc


Paste this:

nginx
# API + live queue (socket.io needs the Upgrade headers)
server {
    listen 80;
    server_name api.64-227-164-200.sslip.io;
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:4700;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 1h;
    }
}

# Website, clinic console, admin portal
server {
    listen 80;
    server_name app.64-227-164-200.sslip.io;

    location / {
        proxy_pass http://127.0.0.1:4600;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}


Enable it, remove the default site, then test and reload nginx:

sh
sudo ln -s /etc/nginx/sites-available/okidoc /etc/nginx/sites-enabled/okidoc
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx


You can now check plain HTTP: http://app.64-227-164-200.sslip.io should open the landing page.

---

## Step 9: Get the free HTTPS certificates

sh
sudo certbot --nginx \
  -d app.64-227-164-200.sslip.io \
  -d api.64-227-164-200.sslip.io \
  --redirect --agree-tos -m <your email>


Certbot gets the certificates from Let's Encrypt, adds HTTPS to the nginx file, and redirects HTTP to HTTPS. The certificates renew automatically. To check that renewal works:

sh
sudo certbot renew --dry-run


---

## Step 10: Test

| Check | Expected |
|---|---|
| Open https://app.64-227-164-200.sslip.io | Landing page, with a padlock in the browser |
| Open https://api.64-227-164-200.sslip.io/api/v1/health | {"ok":true,...} |
| Click "Clinic login", then sign in with your admin phone and password | Asks for an OTP (see the note below) |
| Open a clinic queue in the console | The live queue updates without refreshing the page |

*OTP note:* SMS_PROVIDER=console is still set, so SMS messages are not sent. Find the OTP code in the API log:

sh
docker compose logs --tail=50 api | grep -i otp


Set up MSG91 (SMS_PROVIDER=msg91 plus its keys in .env, then docker compose up -d) before real users sign up.

---

## Step 11: Phone app

Set the app's API address to:


https://api.64-227-164-200.sslip.io


Then build the APK again. Because this is HTTPS, release builds work without allowing plain-HTTP traffic.

---

## Everyday commands

Run these from /opt/okidoc.

sh
docker compose ps                       # status
docker compose logs -f api              # live API log (Ctrl+C to stop)
docker compose restart api              # restart the API
docker compose down                     # stop everything (data is kept)
docker compose up -d                    # start again


Never run docker compose down -v. It deletes the database and uploaded files.

### Updating to a new version

sh
cd /opt/okidoc
git pull                                # or copy a new okidoc.tgz as in Step 3, Option B
docker compose up -d --build            # the API updates the database by itself on start
docker image prune -f


### Backup

sh
# Database
docker compose exec -T db pg_dump -U okidoc -Fc okidoc > /root/okidoc-$(date +%F).dump

# Uploaded files
docker run --rm -v okidoc_uploads:/data -v /root:/backup debian:bookworm-slim \
  tar czf /backup/uploads-$(date +%F).tgz -C /data .


Copy the backups off the server regularly.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| certbot: "Timeout during connect" or "Connection refused" | Port 80 is blocked. Check the DigitalOcean firewall and ufw, and that nginx is running (systemctl status nginx). |
| certbot: "too many certificates" or "rateLimited" | sslip.io is shared with many users. Wait an hour and try again, or use a different prefix such as okidoc. and okidoc-api. (update .env and nginx to match). |
| api container keeps restarting | Run docker compose logs api. Usually a JWT secret is still change-me, or POSTGRES_PASSWORD was changed after the first start. |
| Website loads but login or data fails | PUBLIC_API_URL or CORS_ORIGINS is wrong. Fix .env, then run docker compose up -d --build (the website must be rebuilt). |
| Live queue doesn't update by itself | The nginx API block is missing the Upgrade and Connection lines. |
| 502 Bad Gateway | The container is down or still starting. Run docker compose ps and check the logs. |
| Upload fails ("413 Request Entity Too Large") | Raise client_max_body_size in the nginx API block, then sudo systemctl reload nginx. |

---

## When you buy a domain

1. Point DNS for, for example, okidoc.in and api.okidoc.in to 64.227.164.200.
2. Replace the sslip.io names in .env and in /etc/nginx/sites-available/okidoc.
3. Run docker compose up -d --build (rebuilds the website with the new API address).
4. Run sudo nginx -t && sudo systemctl reload nginx, then run certbot again with the new names.
5. Update the phone app's API address and release a new build.
