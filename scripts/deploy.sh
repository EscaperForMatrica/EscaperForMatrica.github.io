#!/bin/sh
# Выкладка на хостинг lite-host (cPanel + Phusion Passenger, Node.js из /opt/alt).
# Сборка — здесь; на сервере только зависимости и перезапуск, статика — в корне сайта. База и загрузки лежат в ~/palada-data
# (DB_PATH в ~/palada-app/.env на сервере) и при выкладке не трогаются.
#   DEPLOY_HOST=<ssh-хост из ~/.ssh/config> sh scripts/deploy.sh
set -e
HOST="${DEPLOY_HOST:?Укажите DEPLOY_HOST — SSH-хост из ~/.ssh/config}"
APP="${APP_ROOT:-palada-app}"
DOCROOT="${SITE_ROOT:-palada.shop}"
NODE_BIN="${APP_NODE_BIN:-/opt/alt/alt-nodejs24/root/usr/bin}"

npm run fonts
node scripts/image-variants.mjs
npm run build
rsync -az --delete dist/ "$HOST:$APP/dist/"
# Статика (/_astro, /images, /fonts) — прямо в корень сайта: её отдаёт веб-сервер с долгим кэшем, без Node
rsync -az --delete --exclude=.htaccess --exclude=cgi-bin --exclude=.well-known dist/client/ "$HOST:$DOCROOT/"
rsync -az package.json package-lock.json app.cjs "$HOST:$APP/"
ssh "$HOST" "set -e
  cd ~/$APP
  PATH=$NODE_BIN:\$PATH npm install --omit=dev --no-audit --no-fund --loglevel=error
  mkdir -p tmp && touch tmp/restart.txt
  echo 'Готово: Passenger перезапустит приложение при следующем запросе'"
