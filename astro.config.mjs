// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import serviceWorker from './src/sw/adapter.mjs';

// PAGES=1 — сборка для GitHub Pages: сервер магазина упаковывается в service worker (см. scripts/build-pages.mjs)
const pages = process.env.PAGES === '1';

const siteHost = (() => {
  try {
    return process.env.SITE_URL ? new URL(process.env.SITE_URL).hostname : '';
  } catch {
    return '';
  }
})();

// Весь магазин рендерится на сервере (корзина, сессии, кабинет, админка).
export default defineConfig({
  output: 'server',
  adapter: pages ? serviceWorker() : node({ mode: 'standalone' }),
  outDir: pages ? './dist-pages' : './dist',
  site: process.env.SITE_URL || undefined,
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
  server: { port: 4500, host: true },
  security: {
    // В service worker нет заголовков Origin/Sec-Fetch-Site, а запросы и так не покидают браузер
    checkOrigin: !pages,
    // За прокси хостинга (nginx → Apache → Passenger) доверяем X-Forwarded-Host/Proto только для своих доменов
    allowedDomains: [
      { hostname: 'palada.su', protocol: 'https' },
      { hostname: 'www.palada.su', protocol: 'https' },
      ...(siteHost && !siteHost.endsWith('palada.su') ? [{ hostname: siteHost, protocol: 'https' }] : []),
    ],
  },
  vite: {
    // node:sqlite — встроенный модуль Node, не бандлим
    ssr: { external: ['node:sqlite'] },
  },
});
