// Демо на GitHub Pages закрыто: магазин переехал на https://palada.shop.
// Этот service worker заменяет прежний (сервер демо в браузере), удаляет демо-данные и снимает себя.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    indexedDB.deleteDatabase('palada-demo');
    for (const key of await caches.keys()) await caches.delete(key);
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      const url = new URL(client.url);
      client.navigate('https://palada.shop' + url.pathname + url.search + url.hash).catch(() => {});
    }
  })());
});
