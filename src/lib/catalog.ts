import { db } from './db';
import { discountPct } from './format';

export interface Category {
  id: number;
  slug: string;
  name: string;
  sort: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  variant: string;
  subtitle: string;
  sku: string;
  category_id: number | null;
  category_slug?: string;
  category_name?: string;
  washes: number | null;
  description: string;
  usage: string;
  usage_note: string;
  composition: string;
  specs: [string, string][];
  images: string[];
  price: number | null;
  old_price: number | null;
  stock: number;
  wholesale_price: number | null;
  box_qty: number;
  visible: number;
  popular: number;
  sort: number;
  sales: number;
  related: number[];
  discount: number;
  available: boolean;
}

const BASE = `select p.*, c.slug as category_slug, c.name as category_name from products p left join categories c on c.id = p.category_id`;

export function hydrate(row: any): Product {
  const p = { ...row } as any;
  for (const k of ['specs', 'images', 'related']) {
    try { p[k] = JSON.parse(row[k] || '[]'); } catch { p[k] = []; }
  }
  p.discount = discountPct(p.price, p.old_price);
  p.available = p.price !== null && p.stock > 0;
  return p as Product;
}

export function categories(): Category[] {
  return db.all<Category>('select * from categories order by sort');
}

export function categoryBySlug(slug: string) {
  return db.get<Category>('select * from categories where slug = ?', slug);
}

/** Подзаголовок карточки: «5 литров · 165 стирок» / «600 мл». */
export function cardMeta(p: Product, short = false): string {
  if (p.washes) return `${short ? p.variant.replace(' литров', ' л').replace(' литра', ' л') : p.variant} · ${p.washes} стирок`;
  if (short) return p.variant.replace('Зелёное яблоко', 'Яблоко');
  return p.variant;
}

export type SortKey = 'popular' | 'cheap' | 'expensive' | 'discount' | 'new';
export const SORTS: Record<SortKey, string> = {
  popular: 'Сначала популярные',
  cheap: 'Сначала дешевле',
  expensive: 'Сначала дороже',
  discount: 'По размеру скидки',
  new: 'Новинки',
};

const ORDER: Record<SortKey, string> = {
  popular: '(p.stock > 0) desc, p.sales desc, p.sort',
  cheap: '(p.stock > 0) desc, p.price asc',
  expensive: '(p.stock > 0) desc, p.price desc',
  discount: '(p.stock > 0) desc, (1.0 - p.price * 1.0 / coalesce(p.old_price, p.price)) desc, p.sort',
  new: 'p.created_at desc, p.id desc',
};

export interface ListOpts {
  category?: string;
  q?: string;
  sort?: SortKey;
  limit?: number;
  offset?: number;
}

function whereFor(o: ListOpts) {
  const where = ['p.visible = 1', 'p.price is not null'];
  const params: any[] = [];
  if (o.category) {
    where.push('c.slug = ?');
    params.push(o.category);
  }
  if (o.q) {
    // SQLite lower() не понимает кириллицу — ищем по нормализованной строке в JS ниже
    where.push('(p.search like ? or p.sku like ?)');
    params.push(`%${norm(o.q)}%`, `%${o.q.trim()}%`);
  }
  return { sql: where.join(' and '), params };
}

export function norm(s: string) {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** Колонка search — нормализованный текст (lower() в SQLite не понимает кириллицу). */
let searchReady = false;
export function ensureSearch() {
  if (searchReady) return;
  reindexSearch();
  searchReady = true;
}

export function reindexSearch(id?: number) {
  const rows = id ? db.all('select id, name, variant, sku from products where id = ?', id) : db.all('select id, name, variant, sku from products');
  for (const r of rows) db.run('update products set search = ? where id = ?', norm(`${r.name} ${r.variant} ${r.sku}`), r.id);
}

export function listProducts(o: ListOpts = {}): { items: Product[]; total: number } {
  ensureSearch();
  const w = whereFor(o);
  const total = db.value<number>(`select count(*) from products p left join categories c on c.id = p.category_id where ${w.sql}`, ...w.params) || 0;
  const items = db
    .all(`${BASE} where ${w.sql} order by ${ORDER[o.sort || 'popular']} limit ? offset ?`, ...w.params, o.limit ?? 1000, o.offset ?? 0)
    .map(hydrate);
  return { items, total };
}

export function categoryCounts(q?: string): Record<string, number> {
  ensureSearch();
  const w = whereFor({ q });
  const rows = db.all(`select c.slug, count(*) as n from products p left join categories c on c.id = p.category_id where ${w.sql} group by c.slug`, ...w.params);
  const out: Record<string, number> = {};
  let all = 0;
  for (const r of rows) {
    out[r.slug] = r.n;
    all += r.n;
  }
  out.all = all;
  return out;
}

export function popularProducts(category?: string, limit = 8): Product[] {
  const params: any[] = [];
  let where = 'p.visible = 1 and p.price is not null';
  if (category) {
    where += ' and c.slug = ?';
    params.push(category);
  }
  return db.all(`${BASE} where ${where} order by p.popular desc, (p.stock > 0) desc, p.sales desc, p.sort limit ?`, ...params, limit).map(hydrate);
}

export function productBySlug(slug: string): Product | undefined {
  const r = db.get(`${BASE} where p.slug = ?`, slug);
  return r ? hydrate(r) : undefined;
}

export function productById(id: number): Product | undefined {
  const r = db.get(`${BASE} where p.id = ?`, id);
  return r ? hydrate(r) : undefined;
}

export function productsByIds(ids: number[]): Product[] {
  if (!ids.length) return [];
  const rows = db.all(`${BASE} where p.id in (${ids.map(() => '?').join(',')})`, ...ids).map(hydrate);
  return ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Product[];
}

/** «С этим покупают»: заданные в админке, иначе — популярные из других категорий. */
export function relatedProducts(p: Product, limit = 4): Product[] {
  const fixed = productsByIds(p.related).filter((x) => x.visible && x.price !== null);
  if (fixed.length >= limit) return fixed.slice(0, limit);
  const exclude = [p.id, ...fixed.map((x) => x.id)];
  const more = db
    .all(
      `${BASE} where p.visible = 1 and p.price is not null and p.stock > 0 and p.id not in (${exclude.map(() => '?').join(',')})
       order by (p.category_id = ?) desc, p.sales desc limit ?`,
      ...exclude, p.category_id ?? 0, limit - fixed.length,
    )
    .map(hydrate);
  return [...fixed, ...more];
}

export function slugify(s: string): string {
  const map: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  return s
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'tovar';
}
