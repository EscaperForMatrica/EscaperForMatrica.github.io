// Service worker статичной версии магазина (GitHub Pages).
// Сервер Astro работает прямо здесь: страницы и API рендерятся в браузере посетителя,
// база SQLite (sql.js) и cookie сессии хранятся в IndexedDB этого браузера.
import { Buffer } from 'buffer';
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js';

globalThis.Buffer = Buffer;
globalThis.process = globalThis.process || { env: {}, cwd: () => '/', versions: {}, platform: 'browser', nextTick: (f, ...a) => Promise.resolve().then(() => f(...a)) };
Object.assign(globalThis.process.env, { DEMO_MODE: 'true', NODE_ENV: 'production', SITE_URL: self.location.origin });
globalThis.__palada = { SQL: null, db: null, bytes: null, dirty: false };

const STATIC = /^\/(?:_astro\/|images\/|fonts\/|favicon\.png$|sw\.js$|sql-wasm[^/]*\.wasm$|boot\.html$|robots\.txt$)/;
const IDB = 'palada-demo';
const STORE = 'kv';

// ── IndexedDB ──────────────────────────────────────────────
function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function kvGet(key) {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function kvSet(key, value) {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Инициализация: sql.js + сохранённая база + cookie ─────────
let app = null;
let jar = new Map();
let booting = null;

function boot() {
  if (!booting) {
    booting = (async () => {
      const SQL = await initSqlJs({ locateFile: () => '/sql-wasm-browser.wasm' });
      globalThis.__palada.SQL = SQL;
      globalThis.__palada.bytes = (await kvGet('db')) || null;
      jar = new Map((await kvGet('cookies')) || []);
      app = await import('../../dist-pages/server/entry.mjs');
    })().catch((e) => {
      booting = null;
      throw e;
    });
  }
  return booting;
}

let saving = Promise.resolve();
function persist() {
  const s = globalThis.__palada;
  if (!s.db || !s.dirty) return saving;
  s.dirty = false;
  const bytes = s.db.export();
  // export() переоткрывает базу и сбрасывает pragma
  s.db.exec('pragma foreign_keys = on');
  saving = saving.then(() => kvSet('db', bytes)).catch((e) => console.error('[sw] save db', e));
  return saving;
}

function applyCookies(list) {
  let changed = false;
  for (const raw of list) {
    const [pair, ...attrs] = String(raw).split(';');
    const i = pair.indexOf('=');
    if (i < 0) continue;
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    const opts = Object.fromEntries(attrs.map((a) => {
      const [k, ...v] = a.trim().split('=');
      return [k.toLowerCase(), v.join('=')];
    }));
    const expired = (opts['max-age'] !== undefined && Number(opts['max-age']) <= 0) || (opts.expires && new Date(opts.expires).getTime() < Date.now());
    if (expired) changed = jar.delete(name) || changed;
    else {
      jar.set(name, value);
      changed = true;
    }
  }
  return changed ? kvSet('cookies', [...jar]) : Promise.resolve();
}

// Request с заголовками без ограничений: Cookie нельзя положить в Request, созданный скриптом
class AppRequest extends Request {
  constructor(input, init, headers) {
    super(input, init);
    this._headers = headers;
  }
  get headers() {
    return this._headers;
  }
}

async function serve(event) {
  const req = event.request;
  await boot();
  const headers = new Headers(req.headers);
  const cookies = [...jar].map(([k, v]) => `${k}=${v}`);
  if (cookies.length) headers.set('cookie', cookies.join('; '));
  if (!headers.get('origin')) headers.set('origin', self.location.origin);
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const init = { method: req.method, headers, redirect: 'manual', body: hasBody ? await req.arrayBuffer() : undefined };
  const request = new AppRequest(req.url, init, headers);

  let result;
  try {
    result = await app.handle(request);
  } catch (e) {
    console.error('[sw] render failed', e);
    return new Response(`<!doctype html><meta charset="utf-8"><title>Ошибка</title><p style="font:16px system-ui;padding:32px">Не удалось открыть страницу. <a href="/">На главную</a></p>`, { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  const tasks = [persist()];
  if (result.cookies.length) tasks.push(applyCookies(result.cookies));
  event.waitUntil(Promise.all(tasks));
  return result.response;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (STATIC.test(url.pathname)) return;
  event.respondWith(serve(event));
});

