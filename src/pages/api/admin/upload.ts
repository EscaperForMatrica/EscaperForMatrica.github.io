import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../../lib/config';
import { json, fail } from '../../../lib/http';

const IMG: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const DOC: Record<string, string> = { 'application/pdf': '.pdf' };

// Загрузка фото товаров и документов (PDF) в data/uploads
export const POST: APIRoute = async ({ request }) => {
  const fd = await request.formData().catch(() => null);
  const file = fd?.get('file');
  if (!(file instanceof File)) return fail('Файл не получен');
  const kind = fd?.get('kind') === 'doc' ? 'doc' : 'img';
  const types = kind === 'doc' ? DOC : IMG;
  const ext = types[file.type];
  if (!ext) return fail(kind === 'doc' ? 'Подходит только PDF' : 'Подходят JPG, PNG или WebP');
  if (file.size > (kind === 'doc' ? 15 : 8) * 1024 * 1024) return fail('Файл слишком большой');
  const buf = Buffer.from(await file.arrayBuffer());
  // Проверяем сигнатуру, а не только заявленный тип
  const sig = buf.subarray(0, 12).toString('hex');
  const okSig = kind === 'doc' ? sig.startsWith('25504446') : sig.startsWith('ffd8ff') || sig.startsWith('89504e47') || (sig.startsWith('52494646') && buf.subarray(8, 12).toString() === 'WEBP');
  if (!okSig) return fail('Файл повреждён или имеет другой формат');
  const dir = path.join(config.uploadsDir, kind === 'doc' ? 'docs' : 'products');
  fs.mkdirSync(dir, { recursive: true });
  const name = crypto.randomBytes(10).toString('hex') + ext;
  fs.writeFileSync(path.join(dir, name), buf);
  return json({ ok: true, url: `/uploads/${kind === 'doc' ? 'docs' : 'products'}/${name}` });
};
