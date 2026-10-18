import { db } from './db';
import { hydrate, type Product } from './catalog';
import { ownerKey } from './session';

export function favIds(locals: App.Locals): Set<number> {
  const owner = ownerKey(locals);
  if (!owner) return new Set();
  return new Set(db.all<{ product_id: number }>('select product_id from favorites where owner = ?', owner).map((r) => r.product_id));
}

export function favProducts(locals: App.Locals): Product[] {
  const owner = ownerKey(locals);
  if (!owner) return [];
  return db
    .all(
      `select p.*, c.slug as category_slug, c.name as category_name from favorites f join products p on p.id = f.product_id
       left join categories c on c.id = p.category_id where f.owner = ? and p.visible = 1 order by f.added_at desc`,
      owner,
    )
    .map(hydrate);
}

export function favCount(locals: App.Locals): number {
  const owner = ownerKey(locals);
  if (!owner) return 0;
  return db.value<number>('select count(*) from favorites f join products p on p.id = f.product_id where f.owner = ? and p.visible = 1', owner) || 0;
}

export function toggleFav(owner: string, productId: number, on?: boolean): boolean {
  const has = Boolean(db.value('select 1 from favorites where owner = ? and product_id = ?', owner, productId));
  const next = on ?? !has;
  if (next && !has) db.run('insert into favorites (owner, product_id) values (?, ?)', owner, productId);
  if (!next && has) db.run('delete from favorites where owner = ? and product_id = ?', owner, productId);
  return next;
}
