import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../lib/config';

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' };

// Загруженные в админке фото товаров и документы (data/uploads)
export const GET: APIRoute = ({ params }) => {
  const rel = String(params.path || '');
  const file = path.resolve(config.uploadsDir, rel);
  if (!file.startsWith(config.uploadsDir + path.sep) || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext];
  if (!type) return new Response('Not found', { status: 404 });
  const headers: Record<string, string> = { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' };
  if (ext === '.pdf') headers['content-disposition'] = `inline; filename="${path.basename(file)}"`;
  return new Response(fs.readFileSync(file), { headers });
};
