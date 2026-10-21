import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { db } from './db';
import { isProd } from './config';

export const SID_COOKIE = 'palada_sid';
const MAX_AGE = 60 * 60 * 24 * 180;

export interface User {
  id: number;
  phone: string;
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'b2b';
  company_id: number | null;
  position: string;
  newsletter: number;
  offer_accepted_at: string | null;
  pd_consent_at: string | null;
  created_at: string;
}

export interface Company {
  id: number;
  inn: string;
  kpp: string;
  ogrn: string;
  name: string;
  address: string;
  status: string;
}

export interface SessionState {
  sid: string | null;
  user: User | null;
  company: Company | null;
}

export function loadSession(cookies: AstroCookies): SessionState {
  const sid = cookies.get(SID_COOKIE)?.value || null;
  if (!sid || !/^[a-f0-9]{48}$/.test(sid)) return { sid: null, user: null, company: null };
  const s = db.get<{ id: string; user_id: number | null; seen_at: string }>('select id, user_id, seen_at from sessions where id = ?', sid);
  if (!s) return { sid: null, user: null, company: null };
  // seen_at обновляем не чаще раза в час
  db.run(`update sessions set seen_at = datetime('now') where id = ? and seen_at < datetime('now', '-1 hour')`, sid);
  const user = s.user_id ? db.get<User>('select * from users where id = ?', s.user_id) || null : null;
  const company = user?.company_id ? db.get<Company>('select * from companies where id = ?', user.company_id) || null : null;
  return { sid, user, company };
}

function setCookie(cookies: AstroCookies, sid: string) {
  cookies.set(SID_COOKIE, sid, { path: '/', httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: MAX_AGE });
}

/** Сессия создаётся только когда нужна (корзина, избранное, вход), чтобы не плодить записи от ботов. */
export function ensureSession(cookies: AstroCookies, locals: App.Locals): string {
  if (locals.sid) return locals.sid;
  const sid = crypto.randomBytes(24).toString('hex');
  db.run('insert into sessions (id) values (?)', sid);
  setCookie(cookies, sid);
  locals.sid = sid;
  return sid;
}

/** Ключ владельца корзины и избранного. */
export function ownerKey(locals: App.Locals): string | null {
  if (locals.user) return `u:${locals.user.id}`;
  if (locals.sid) return `s:${locals.sid}`;
  return null;
}

export function cartMode(locals: App.Locals): 'retail' | 'b2b' {
  return locals.user?.role === 'b2b' && locals.company ? 'b2b' : 'retail';
}

/** После входа: новая сессия (защита от фиксации), перенос корзины и избранного гостя. */
export function signIn(cookies: AstroCookies, locals: App.Locals, userId: number) {
  const oldSid = locals.sid;
  const sid = crypto.randomBytes(24).toString('hex');
  db.tx(() => {
    db.run('insert into sessions (id, user_id, promo_code) values (?, ?, (select promo_code from sessions where id = ?))', sid, userId, oldSid ?? '');
    if (oldSid) {
      const from = `s:${oldSid}`;
      const to = `u:${userId}`;
      for (const it of db.all('select * from cart_items where owner = ?', from)) {
        db.run(
          `insert into cart_items (owner, mode, product_id, qty) values (?, ?, ?, ?)
           on conflict(owner, mode, product_id) do update set qty = max(qty, excluded.qty)`,
          to, it.mode, it.product_id, it.qty,
        );
      }
      db.run('insert or ignore into favorites (owner, product_id, added_at) select ?, product_id, added_at from favorites where owner = ?', to, from);
      db.run('delete from cart_items where owner = ?', from);
      db.run('delete from favorites where owner = ?', from);
      db.run('update orders set user_id = ? where session_id = ? and user_id is null', userId, oldSid);
      db.run('delete from sessions where id = ?', oldSid);
    }
    // Гостевые заказы с этой почтой — в кабинет
    const email = db.value<string>('select email from users where id = ?', userId);
    if (email) db.run('update orders set user_id = ? where lower(email) = ? and user_id is null', userId, email);
  });
  setCookie(cookies, sid);
  locals.sid = sid;
}

export function signOut(cookies: AstroCookies, locals: App.Locals) {
  if (locals.sid) db.run('delete from sessions where id = ?', locals.sid);
  cookies.delete(SID_COOKIE, { path: '/' });
  locals.sid = null;
  locals.user = null;
  locals.company = null;
}
