// node:fs → виртуальная файловая система в таблице vfs той же базы (загруженные фото и документы).
const db = () => globalThis.__palada && globalThis.__palada.db;
let ready = false;
function table() {
  const d = db();
  if (!d) return null;
  if (!ready) {
    d.exec('create table if not exists vfs (path text primary key, data blob not null)');
    ready = true;
  }
  return d;
}
function read(p) {
  const d = table();
  if (!d) return null;
  const st = d.prepare('select data from vfs where path = ?');
  st.bind([String(p)]);
  const row = st.step() ? st.get()[0] : null;
  st.free();
  return row;
}

export function existsSync(p) {
  // Шрифты лежат на хостинге как статика
  if (String(p).endsWith('.woff2')) return true;
  return read(p) !== null;
}
export function mkdirSync() {}
export function readFileSync(p, enc) {
  const data = read(p);
  if (data === null) {
    const e = new Error(`ENOENT: ${p}`);
    e.code = 'ENOENT';
    throw e;
  }
  const b = Buffer.from(data);
  return enc ? b.toString(enc) : b;
}
export function writeFileSync(p, data) {
  const d = table();
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  const st = d.prepare('insert or replace into vfs (path, data) values (?, ?)');
  st.run([String(p), bytes]);
  st.free();
  globalThis.__palada.dirty = true;
}
export function rmSync(p) {
  const d = table();
  if (!d) return;
  const st = d.prepare('delete from vfs where path = ?');
  st.run([String(p)]);
  st.free();
  globalThis.__palada.dirty = true;
}
export const promises = {};
export default { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, promises };
