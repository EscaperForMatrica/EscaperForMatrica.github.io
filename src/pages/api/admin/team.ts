import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, str, int } from '../../../lib/http';
import { config } from '../../../lib/config';
import { isEmail } from '../../../lib/format';
import { normEmail } from '../../../lib/auth';

// Администраторы: add (по почте) | grant (из клиентов) | revoke
export const POST: APIRoute = async ({ request, locals }) => {
  const b = await body(request);
  if (b.action === 'add') {
    const email = normEmail(str(b.email, 120));
    if (!isEmail(email)) return fail('Проверьте адрес почты', 400, { field: 'email' });
    const name = str(b.name, 120) || 'Администратор';
    const u = db.get<any>('select id from users where email = ?', email);
    if (u) db.run(`update users set role = 'admin' where id = ?`, u.id);
    else db.run(`insert into users (email, name, role) values (?, ?, 'admin')`, email, name);
    return json({ ok: true });
  }
  const id = int(b.id);
  const u = db.get<any>('select * from users where id = ?', id);
  if (!u) return fail('Пользователь не найден', 404);
  if (b.action === 'grant') {
    db.run(`update users set role = 'admin' where id = ?`, id);
    return json({ ok: true });
  }
  if (b.action === 'revoke') {
    if (u.id === locals.user?.id) return fail('Нельзя снять права с самого себя');
    if (config.adminEmails.includes(u.email)) return fail('Этот администратор задан в настройках сервера (ADMIN_EMAILS)');
    const left = db.value<number>(`select count(*) from users where role = 'admin' and id != ?`, id) || 0;
    if (!left) return fail('Должен остаться хотя бы один администратор');
    db.run(`update users set role = case when company_id is not null then 'b2b' else 'customer' end where id = ?`, id);
    return json({ ok: true });
  }
  return fail('Неизвестное действие');
};
