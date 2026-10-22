// Уменьшенные копии фото для карточек и миниатюр: <имя>-480.webp рядом с оригиналом 1000×1000,
// баннер главной — hero-gels-720.webp. Создаёт только недостающие, запускается перед сборкой (scripts/deploy.sh).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..', 'public', 'images');
const jobs = [];
for (const f of fs.readdirSync(path.join(root, 'products'))) {
  if (!f.endsWith('.webp') || f.endsWith('-480.webp')) continue;
  jobs.push([path.join(root, 'products', f), path.join(root, 'products', f.replace(/\.webp$/, '-480.webp')), 480]);
}
jobs.push([path.join(root, 'hero-gels.webp'), path.join(root, 'hero-gels-720.webp'), 720]);

let made = 0;
for (const [src, out, size] of jobs) {
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) continue;
  await sharp(src).resize(size, size, { fit: 'inside' }).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toFile(out);
  made++;
}
console.log(`[images] уменьшенных копий создано: ${made}, всего: ${jobs.length}`);
