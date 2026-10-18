// Серверный вход для service worker: рендер запроса приложением Astro.
import { createApp } from 'astro/app/entrypoint';
import { App } from 'astro/app';

const app = createApp({ streaming: false });

/** Рендерит запрос; Set-Cookie возвращаются отдельно — в service worker их нельзя положить в заголовки ответа. */
export async function handle(request) {
  const response = await app.render(request, { addCookieHeader: false, clientAddress: '127.0.0.1' });
  const cookies = [...App.getSetCookieFromResponse(response)];
  return { response, cookies };
}
