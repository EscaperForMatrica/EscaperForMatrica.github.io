// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

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
  adapter: node({ mode: 'standalone' }),
  site: process.env.SITE_URL || undefined,
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
  server: { port: 4500, host: true },
  security: {
    checkOrigin: true,
    // За прокси хостинга (Render и т. п.) доверяем X-Forwarded-Host/Proto только для своих доменов
    allowedDomains: [
      { hostname: '**.onrender.com', protocol: 'https' },
      ...(siteHost ? [{ hostname: siteHost, protocol: 'https' }] : []),
    ],
  },
  vite: {
    // node:sqlite — встроенный модуль Node, не бандлим
    ssr: { external: ['node:sqlite'] },
  },
});
