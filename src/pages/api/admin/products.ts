import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, str, bool } from '../../../lib/http';
import { slugify, reindexSearch } from '../../../lib/catalog';

const intOrNull = (v: unknown) => {
  const s = String(v ?? '').replace(/\s/g, '');
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

// Товары: save | visible | delete (доступ только администратору — проверка в middleware)
export const POST: APIRoute = async ({ request }) => {
  const b = await body(request);
  const ids: number[] = Array.isArray(b.ids) ? b.ids.map(Number).filter(Boolean) : [];

  if (b.action === 'visible') {
    if (!ids.length) return fail('Не выбраны товары');
    db.run(`update products set visible = ?, updated_at = datetime('now') where id in (${ids.map(() => '?').join(',')})`, bool(b.on) ? 1 : 0, ...ids);
    return json({ ok: true });
  }
  if (b.action === 'delete') {
    if (!ids.length) return fail('Не выбраны товары');
    db.run(`delete from products where id in (${ids.map(() => '?').join(',')})`, ...ids);
    return json({ ok: true });
  }
  if (b.action !== 'save') return fail('Неизвестное действие');

  const name = str(b.name, 160);
  if (!name) return fail('Укажите название товара');
  const price = intOrNull(b.price);
  const old = intOrNull(b.old_price);
  const stock = intOrNull(b.stock) ?? 0;
  const ws = intOrNull(b.wholesale_price);
  const box = intOrNull(b.box_qty) || 1;
  const washes = intOrNull(b.washes);
  if ([price, old, stock, ws, box, washes].some((v) => Number.isNaN(v))) return fail('Цены, остаток и количество — целые неотрицательные числа');
  if (old !== null && price !== null && old <= price) return fail('Старая цена должна быть больше текущей — иначе скидка не покажется');
  const visible = bool(b.visible);
  if (visible && price === null) return fail('Чтобы показать товар на сайте, задайте цену');
  const images = (Array.isArray(b.images) ? b.images : []).map((s: unknown) => str(s, 300)).filter((s: string) => s.startsWith('/uploads/') || s.startsWith('ph:'));
  const specs = (Array.isArray(b.specs) ? b.specs : []).filter((r: unknown) => Array.isArray(r) && r.length === 2).map(([k, v]: string[]) => [str(k, 80), str(v, 200)]).filter(([k, v]: string[]) => k && v);
  const sku = str(b.sku, 40);
  if (sku && !specs.some(([k]: string[]) => k === 'Артикул')) specs.push(['Артикул', sku]);
  specs.push(['Маркировка', '«Честный знак»']);
  const usage = str(b.usage, 3000).split('\n').map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).join('\n');
  const variant = str(b.variant, 120);
  const categoryId = Number(b.category_id) || null;

  const fields = {
    name, variant, sku, category_id: categoryId, washes, description: str(b.description, 5000), usage, composition: str(b.composition, 2000),
    specs: JSON.stringify(specs), images: JSON.stringify(images), price, old_price: old, stock, wholesale_price: ws, box_qty: box,
    visible: visible ? 1 : 0, popular: bool(b.popular) ? 1 : 0,
  };
  const id = Number(b.id) || 0;
  if (id) {
    const exists = db.value('select 1 from products where id = ?', id);
    if (!exists) return fail('Товар не найден', 404);
    const keys = Object.keys(fields);
    db.run(`update products set ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') where id = ?`, ...(Object.values(fields) as any[]), id);
    reindexSearch(id);
    return json({ ok: true, id });
  }
  let slug = slugify(`${name} ${variant}`);
  while (db.value('select 1 from products where slug = ?', slug)) slug += '-' + Math.random().toString(36).slice(2, 5);
  const keys = Object.keys(fields);
  const newId = Number(
    db.run(`insert into products (slug, ${keys.join(', ')}, sort) values (?, ${keys.map(() => '?').join(', ')}, (select coalesce(max(sort), 0) + 1 from products))`, slug, ...(Object.values(fields) as any[])).lastInsertRowid,
  );
  reindexSearch(newId);
  return json({ ok: true, id: newId });
};
