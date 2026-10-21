#!/bin/sh
# Выкладка на хостинг lite-host (cPanel + Phusion Passenger, Node.js из /opt/alt).
# Сборка — здесь; на сервере только зависимости и перезапуск. База и загрузки лежат в ~/palada-data
# (DB_PATH в ~/palada-app/.env на сервере) и при выкладке не трогаются.
#   DEPLOY_HOST=<ssh-хост из ~/.ssh/config> sh scripts/deploy.sh
set -e
HOST="${DEPLOY_HOST:?Укажите DEPLOY_HOST — SSH-хост из ~/.ssh/config}"
APP="${APP_ROOT:-palada-app}"
NODE_BIN="${APP_NODE_BIN:-/opt/alt/alt-nodejs24/root/usr/bin}"

npm run fonts
npm run build
rsync -az --delete dist/ "$HOST:$APP/dist/"
rsync -az package.json package-lock.json app.cjs "$HOST:$APP/"
ssh "$HOST" "set -e
  cd ~/$APP
  PATH=$NODE_BIN:\$PATH npm install --omit=dev --no-audit --no-fund --loglevel=error
  mkdir -p tmp && touch tmp/restart.txt
  echo 'Готово: Passenger перезапустит приложение при следующем запросе'"
