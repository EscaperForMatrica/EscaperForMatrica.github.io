import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, str } from '../../../lib/http';
import { normPhone } from '../../../lib/format';
import { verifyCode, userByPhone, roleForPhone } from '../../../lib/auth';
import { lookupInn } from '../../../lib/inn';
import { signIn } from '../../../lib/session';

// Шаг 2: проверка кода → вход / создание кабинета / регистрация компании.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const b = await body(request);
  const phone = normPhone(str(b.phone, 40));
  const code = str(b.code, 8).replace(/\D/g, '');
  if (!phone || code.length !== 4) return fail('Введите 4 цифры из СМС', 400, { field: 'code' });
  const r = verifyCode(phone, code);
  if (!r.ok) return json({ ok: false, error: r.error, left: r.left }, 400);

  const p = r.payload || {};
  let user = userByPhone(phone);

  if (r.purpose === 'change-phone') {
    if (!locals.user || locals.user.id !== p.userId) return fail('Сессия устарела', 401);
    db.run('update users set phone = ? where id = ?', phone, locals.user.id);
    return json({ ok: true, redirect: '/account/profile?saved=phone' });
  }

  if (!user) {
    const id = Number(
      db.run(
        `insert into users (phone, name, email, role, newsletter, offer_accepted_at, pd_consent_at) values (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        phone, p.name || '', p.email || '', roleForPhone(phone), p.newsletter ? 1 : 0,
      ).lastInsertRowid,
    );
    user = db.get('select * from users where id = ?', id);
  } else if (r.purpose === 'register' || r.purpose === 'b2b-register') {
    db.run(
      `update users set name = case when ? != '' then ? else name end, email = case when ? != '' then ? else email end, newsletter = ?,
       offer_accepted_at = coalesce(offer_accepted_at, datetime('now')), pd_consent_at = coalesce(pd_consent_at, datetime('now')) where id = ?`,
      p.name || '', p.name || '', p.email || '', p.email || '', p.newsletter ? 1 : 0, user.id,
    );
  }
  // Телефон из ADMIN_PHONES всегда получает роль администратора
  if (roleForPhone(phone) === 'admin' && user.role !== 'admin') db.run(`update users set role = 'admin' where id = ?`, user.id);

  let redirect = str(b.next, 200);
  if (r.purpose === 'b2b-register' && p.inn) {
    let company = db.get<any>('select * from companies where inn = ?', p.inn);
    if (!company) {
      const info = await lookupInn(p.inn).catch(() => null);
      const id = Number(
        db.run('insert into companies (inn, kpp, ogrn, name, address, status) values (?, ?, ?, ?, ?, ?)',
          p.inn, info?.kpp || '', info?.ogrn || '', info?.name || `Компания ИНН ${p.inn}`, info?.address || '', info?.status || '').lastInsertRowid,
      );
      company = { id };
    }
    db.run(`update users set company_id = ?, role = case when role = 'admin' then role else 'b2b' end, position = ? where id = ?`, company.id, p.position || '', user.id);
    redirect = '/b2b/catalog';
  }

  signIn(cookies, locals, user.id);
  const fresh = db.get<any>('select role, company_id from users where id = ?', user.id);
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) {
    redirect = fresh.role === 'admin' ? '/admin' : fresh.company_id ? '/b2b/catalog' : '/account';
  }
  return json({ ok: true, redirect });
};
