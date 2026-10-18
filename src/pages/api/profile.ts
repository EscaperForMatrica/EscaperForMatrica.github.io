import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { json, fail, body, str, bool } from '../../lib/http';
import { isEmail } from '../../lib/format';

// Профиль: личные данные, рассылка, отзыв согласия на обработку ПДн.
export const POST: APIRoute = async ({ request, locals }) => {
  const u = locals.user;
  if (!u) return fail('Войдите в кабинет', 401);
  const b = await body(request);
  if (b.action === 'newsletter') {
    db.run('update users set newsletter = ? where id = ?', bool(b.on) ? 1 : 0, u.id);
    return json({ ok: true });
  }
  if (b.action === 'revoke-pd') {
    db.run('update users set pd_consent_at = null where id = ?', u.id);
    return json({ ok: true });
  }
  if (b.action === 'company-contact') {
    const name = str(b.name, 120);
    const email = str(b.email, 120).toLowerCase();
    if (name.split(/\s+/).filter(Boolean).length < 2) return fail('Укажите фамилию и имя', 400, { field: 'name' });
    if (!isEmail(email)) return fail('Проверьте адрес почты', 400, { field: 'email' });
    db.run('update users set name = ?, email = ?, position = ? where id = ?', name, email, str(b.position, 80), u.id);
    return json({ ok: true });
  }
  const name = str(b.name, 120);
  const email = str(b.email, 120).toLowerCase();
  if (name.split(/\s+/).filter(Boolean).length < 2) return fail('Укажите фамилию и имя', 400, { field: 'name' });
  if (!isEmail(email)) return fail('Проверьте адрес почты', 400, { field: 'email' });
  db.run('update users set name = ?, email = ? where id = ?', name, email, u.id);
  return json({ ok: true });
};
