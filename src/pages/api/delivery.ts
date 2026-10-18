import type { APIRoute } from 'astro';
import { json } from '../../lib/http';
import { findCity, getPoints, pvzEta, deliveryCost } from '../../lib/delivery';

export const GET: APIRoute = ({ url }) => {
  const city = findCity(url.searchParams.get('city') || '');
  const boxes = Math.max(0, parseInt(url.searchParams.get('boxes') || '0', 10) || 0);
  if (!city) return json({ city: null, points: [] });
  const points = getPoints(city).map((p) => ({ id: p.id, address: p.address, hours: p.hours, price: p.price, cost: deliveryCost('ozon', p, boxes), eta: pvzEta(p), x: p.x, y: p.y }));
  return json({ city, points });
};
