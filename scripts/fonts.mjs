// Скачивает Tilda Sans с официального CDN Тильды и кладёт woff2 в public/fonts.
// Файлы шрифта не хранятся в репозитории — их получают при сборке. Ошибка загрузки не ломает сборку:
// без шрифта сайт показывается запасным Arial.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const URL = 'https://static.tildacdn.net/downloads/TildaSans/TildaSans.07Web.zip';
const WEIGHTS = ['Regular', 'Medium', 'Semibold', 'Bold'];
const out = path.resolve('public/fonts');

if (WEIGHTS.every((w) => fs.existsSync(path.join(out, `TildaSans-${w}.woff2`)))) {
  console.log('[fonts] Tilda Sans уже на месте');
  process.exit(0);
}

/** Минимальный разбор zip по центральному каталогу (stored / deflate). */
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('не zip-архив');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('повреждён центральный каталог');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files.set(name, { method, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

try {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const files = unzip(Buffer.from(await res.arrayBuffer()));
  fs.mkdirSync(out, { recursive: true });
  for (const w of WEIGHTS) {
    const name = `TildaSans.07Web/TildaSans-${w}/TildaSans-${w}.woff2`;
    const f = files.get(name);
    if (!f) throw new Error(`нет файла ${name}`);
    const data = f.method === 8 ? zlib.inflateRawSync(f.data) : f.data;
    if (data.subarray(0, 4).toString() !== 'wOF2') throw new Error(`${name} — не woff2`);
    fs.writeFileSync(path.join(out, `TildaSans-${w}.woff2`), data);
  }
  console.log('[fonts] Tilda Sans загружен:', WEIGHTS.join(', '));
} catch (e) {
  console.warn('[fonts] Не удалось загрузить Tilda Sans, сайт будет со шрифтом Arial:', e.message);
}
