import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, str, int } from '../../../lib/http';
import { slugify } from '../../../lib/catalog';

// Категории: create | rename | move (вверх/вниз) | delete (только пустые)
export const POST: APIRoute = async ({ request }) => {
  const b = await body(request);
  if (b.action === 'create') {
    const name = str(b.name, 60);
    if (name.length < 2) return fail('Укажите название категории');
    let slug = slugify(name);
    while (db.value('select 1 from categories where slug = ?', slug)) slug += '-' + Math.random().toString(36).slice(2, 4);
    db.run('insert into categories (slug, name, sort) values (?, ?, (select coalesce(max(sort), 0) + 1 from categories))', slug, name);
    return json({ ok: true });
  }
  const id = int(b.id);
  const cat = db.get<any>('select * from categories where id = ?', id);
  if (!cat) return fail('Категория не найдена', 404);
  if (b.action === 'rename') {
    const name = str(b.name, 60);
    if (name.length < 2) return fail('Укажите название категории');
    db.run('update categories set name = ? where id = ?', name, id);
    return json({ ok: true });
  }
  if (b.action === 'move') {
    const list = db.all<{ id: number }>('select id from categories order by sort, id');
    const i = list.findIndex((c) => c.id === id);
    const j = i + (int(b.dir) < 0 ? -1 : 1);
    if (j < 0 || j >= list.length) return json({ ok: true });
    [list[i], list[j]] = [list[j], list[i]];
    db.tx(() => list.forEach((c, k) => db.run('update categories set sort = ? where id = ?', k, c.id)));
    return json({ ok: true });
  }
  if (b.action === 'delete') {
    const n = db.value<number>('select count(*) from products where category_id = ?', id) || 0;
    if (n) return fail(`В категории ${n} товаров — сначала перенесите их в другую категорию`);
    db.run('delete from categories where id = ?', id);
    return json({ ok: true });
  }
  return fail('Неизвестное действие');
};
