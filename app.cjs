// Точка входа для хостинга с Phusion Passenger (cPanel → «Setup Node.js App»): запускает собранный сервер Astro.
// Passenger сам подставляет порт, адрес из PORT/HOST не нужен.
import('./dist/server/entry.mjs');
