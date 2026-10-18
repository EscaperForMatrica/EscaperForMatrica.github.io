import type { APIRoute } from 'astro';
import { json, fail, body, int } from '../../lib/http';
import { ensureSession, ownerKey } from '../../lib/session';
import { toggleFav, favCount } from '../../lib/favorites';
import { productById } from '../../lib/catalog';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const b = await body(request);
  const p = productById(int(b.id));
  if (!p) return fail('Товар не найден', 404);
  ensureSession(cookies, locals);
  const on = toggleFav(ownerKey(locals)!, p.id, typeof b.on === 'boolean' ? b.on : undefined);
  return json({ ok: true, on, count: favCount(locals) });
};
