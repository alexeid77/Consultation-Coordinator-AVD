# Развёртывание ConsultBot на Ubuntu Server 22.04

## Требования

- Node.js 18+ (рекомендуется 20 LTS)
- PostgreSQL 14+
- npm 9+

## 1. Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # Проверка
```

## 2. Установка PostgreSQL

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

Создание базы данных:

```bash
sudo -u postgres psql -c "CREATE USER consultbot WITH PASSWORD 'ваш_пароль';"
sudo -u postgres psql -c "CREATE DATABASE consultbot OWNER consultbot;"
```

## 3. Клонирование и подготовка проекта

```bash
git clone <url-репозитория> consultbot
cd consultbot
```

### Обязательные изменения в package.json

Откройте `package.json` и внесите следующие изменения:

**а) Полностью удалите секцию `overrides`** (строка ~104–108):

Удалите этот блок целиком:
```json
"overrides": {
  "drizzle-kit": {
    "@esbuild-kit/esm-loader": "npm:tsx@^4.20.4"
  }
},
```

То есть просто удалите эти 5 строк из `package.json`. Запятую у предыдущей секции `devDependencies` тоже подправьте, если нужно.

**б) Удалите Replit-специфичные devDependencies** (строки ~80–82):

Удалите эти три строки:
```json
"@replit/vite-plugin-cartographer": "^0.4.4",
"@replit/vite-plugin-dev-banner": "^0.1.1",
"@replit/vite-plugin-runtime-error-modal": "^0.0.3",
```

### Обязательные изменения в vite.config.ts

Замените содержимое `vite.config.ts` на:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
```

## 4. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
cat > .env << 'EOF'
DATABASE_URL=postgresql://consultbot:ваш_пароль@localhost:5432/consultbot
TELEGRAM_BOT_TOKEN=ваш_токен_бота
SESSION_SECRET=случайная_строка_32_символа
PORT=5000
EOF
```

Загрузите переменные:

```bash
export $(cat .env | xargs)
```

## 5. Установка зависимостей

```bash
npm install
```

## 6. Применение схемы базы данных

```bash
npm run db:push
```

## 7. Сборка проекта

```bash
npm run build
```

## 8. Запуск

```bash
NODE_ENV=production node dist/index.cjs
```

Приложение будет доступно на порту 5000 (или том, что указан в PORT).

## 9. Настройка systemd (автозапуск)

```bash
sudo cat > /etc/systemd/system/consultbot.service << 'EOF'
[Unit]
Description=ConsultBot Telegram Bot & Web Dashboard
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/consultbot
Environment=NODE_ENV=production
EnvironmentFile=/home/ubuntu/consultbot/.env
ExecStart=/usr/bin/node dist/index.cjs
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable consultbot
sudo systemctl start consultbot
```

Проверка статуса:

```bash
sudo systemctl status consultbot
sudo journalctl -u consultbot -f  # Логи в реальном времени
```

## 10. Настройка Nginx (опционально, для проксирования на порт 80/443)

```bash
sudo apt-get install -y nginx

sudo cat > /etc/nginx/sites-available/consultbot << 'EOF'
server {
    listen 80;
    server_name ваш_домен.ru;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/consultbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Для HTTPS используйте Certbot:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ваш_домен.ru
```

## Обновление

```bash
cd /home/ubuntu/consultbot
git pull
npm install
npm run build
sudo systemctl restart consultbot
```
