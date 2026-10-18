// Адаптер Astro для статичного хостинга (GitHub Pages): серверная часть магазина собирается
// в service worker и работает в браузере посетителя. Обычная сборка (`npm run build`) его не использует.
export default function serviceWorkerAdapter() {
  return {
    name: 'palada-sw',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          build: { redirects: false },
          image: { service: { entrypoint: 'astro/assets/services/noop' } },
        });
      },
      'astro:config:done': ({ setAdapter }) => {
        setAdapter({
          name: 'palada-sw',
          entrypointResolution: 'auto',
          serverEntrypoint: new URL('./entry.mjs', import.meta.url),
          adapterFeatures: { buildOutput: 'server', middlewareMode: 'classic' },
          supportedAstroFeatures: { serverOutput: 'stable', staticOutput: 'stable', hybridOutput: 'stable', envGetSecret: 'stable' },
        });
      },
    },
  };
}
