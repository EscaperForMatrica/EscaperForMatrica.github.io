import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { json, fail, body, str, bool } from '../../lib/http';
import { normPhone } from '../../lib/format';

// Профиль: личные данные, рассылка, отзыв согласия на обработку ПДн. Почта меняется по коду (api/auth).
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
  const name = str(b.name, 120);
  const rawPhone = str(b.phone, 40);
  const phone = rawPhone ? normPhone(rawPhone) : '';
  if (name.split(/\s+/).filter(Boolean).length < 2) return fail('Укажите фамилию и имя', 400, { field: 'name' });
  if (rawPhone && !phone) return fail('Проверьте номер телефона', 400, { field: 'phone' });
  if (b.action === 'company-contact') {
    db.run('update users set name = ?, phone = ?, position = ? where id = ?', name, phone, str(b.position, 80), u.id);
    return json({ ok: true });
  }
  db.run('update users set name = ?, phone = ? where id = ?', name, phone, u.id);
  return json({ ok: true });
};
