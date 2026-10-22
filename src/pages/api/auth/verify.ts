import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, str } from '../../../lib/http';
import { verifyCode, userByEmail, roleForEmail, normEmail } from '../../../lib/auth';
import { lookupInn } from '../../../lib/inn';
import { signIn } from '../../../lib/session';
import { config } from '../../../lib/config';

// Шаг 2: проверка кода из письма → вход / создание кабинета / регистрация компании.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const b = await body(request);
  const email = normEmail(str(b.email, 120));
  const code = str(b.code, 8).replace(/\D/g, '');
  if (!email || code.length !== 4) return fail('Введите 4 цифры из письма', 400, { field: 'code' });
  const r = verifyCode(email, code);
  if (!r.ok) return json({ ok: false, error: r.error, left: r.left }, 400);

  const p = r.payload || {};
  let user = userByEmail(email);

  if (r.purpose === 'change-email') {
    if (!locals.user || locals.user.id !== p.userId) return fail('Сессия устарела', 401);
    db.run('update users set email = ? where id = ?', email, locals.user.id);
    return json({ ok: true, redirect: locals.company ? '/b2b/account?tab=contact&saved=email' : '/account/profile?saved=email' });
  }

  if (!user) {
    const id = Number(
      db.run(
        `insert into users (email, phone, name, role, newsletter, offer_accepted_at, pd_consent_at) values (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        email, p.phone || '', p.name || '', roleForEmail(email), p.newsletter ? 1 : 0,
      ).lastInsertRowid,
    );
    user = db.get('select * from users where id = ?', id);
  } else if (r.purpose === 'register' || r.purpose === 'b2b-register') {
    db.run(
      `update users set name = case when ? != '' then ? else name end, phone = case when ? != '' then ? else phone end, newsletter = ?,
       offer_accepted_at = coalesce(offer_accepted_at, datetime('now')), pd_consent_at = coalesce(pd_consent_at, datetime('now')) where id = ?`,
      p.name || '', p.name || '', p.phone || '', p.phone || '', p.newsletter ? 1 : 0, user.id,
    );
  }
  if (roleForEmail(email) === 'admin' && user.role !== 'admin') db.run(`update users set role = 'admin' where id = ?`, user.id);

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
    redirect = fresh.role === 'admin' ? config.adminPath : fresh.company_id ? '/b2b/catalog' : '/account';
  }
  return json({ ok: true, redirect });
};
