import type { APIRoute } from 'astro';
import { placeholderSvg } from '../../../lib/images';

// /img/ph/<форма>-<цвет>[-<ракурс 2..4>|-hero].svg
export const GET: APIRoute = ({ params }) => {
  const [shape, color, v] = String(params.name || '').split('-');
  const svg = v === 'hero' ? placeholderSvg(shape, color, 1, '#e6f4f3') : placeholderSvg(shape, color, Number(v) || 1);
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
};
