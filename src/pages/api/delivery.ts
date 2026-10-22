import type { APIRoute } from 'astro';
import { json } from '../../lib/http';
import { searchPvz, mapUrl } from '../../lib/delivery';

// Поиск пунктов выдачи Wildberries по городу и улице.
export const GET: APIRoute = ({ url }) => {
  const q = (url.searchParams.get('q') || '').slice(0, 120);
  const r = searchPvz(q);
  return json({
    ready: r.ready,
    total: r.total,
    points: r.points.map((p) => ({ id: p.id, address: p.address, hours: p.hours, map: mapUrl(p) })),
  });
};
