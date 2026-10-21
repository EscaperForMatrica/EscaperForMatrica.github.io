import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, str, int } from '../../../lib/http';

// Реквизиты компании (правит администратор)
export const POST: APIRoute = async ({ request }) => {
  const b = await body(request);
  const id = int(b.id);
  if (!db.value('select 1 from companies where id = ?', id)) return fail('Компания не найдена', 404);
  const name = str(b.name, 200);
  if (name.length < 2) return fail('Укажите наименование');
  db.run('update companies set name = ?, kpp = ?, ogrn = ?, address = ? where id = ?', name, str(b.kpp, 20), str(b.ogrn, 20), str(b.address, 300), id);
  return json({ ok: true });
};
