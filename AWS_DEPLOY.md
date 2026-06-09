# AWS EC2 deployment

This guide deploys the app on one Ubuntu EC2 instance with Docker Compose.

## 1. EC2

Recommended minimum for this stack:

- Ubuntu 24.04 LTS
- 2 vCPU / 4 GB RAM or larger
- Security group inbound: 22 from your IP, 80/443 from anywhere
- Do not expose 5432, 7474, or 7687 to the public internet

## 2. Install Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

## 3. Upload code and env

```bash
git clone https://github.com/EJ-pro/SKN27-4th-4team.git
cd SKN27-4th-4team
cp .env.prod.sample .env.prod
nano .env.prod
```

Set at least these values:

- `SECRET_KEY`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `DB_PASSWORD`
- `NEO4J_PASSWORD` and the same password inside `NEO4J_AUTH`
- `OPENAI_API_KEY` or your selected LLM provider variables

Keep `VITE_API_URL` empty for this Nginx setup. The frontend will call `/api/...` on the same domain.

For IP-only HTTP testing before HTTPS, use:

```env
ALLOWED_HOSTS=EC2_PUBLIC_IP
CORS_ALLOWED_ORIGINS=http://EC2_PUBLIC_IP
CSRF_TRUSTED_ORIGINS=http://EC2_PUBLIC_IP
SESSION_COOKIE_SECURE=False
CSRF_COOKIE_SECURE=False
```

## 4. Start

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend
```

Open:

```text
http://EC2_PUBLIC_IP
```

## 5. HTTPS with host Nginx and Certbot

If you want HTTPS on the host, change `.env.prod`:

```env
HTTP_PORT=8080
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
CORS_ALLOWED_ORIGINS=https://your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com
```

Restart the frontend port mapping:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build frontend
```

Install Nginx and Certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/routinegraph`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/routinegraph /etc/nginx/sites-enabled/routinegraph
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 6. Common operations

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f
docker compose --env-file .env.prod -f docker-compose.prod.yml restart backend
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```
