import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { config } from './config';
import { seed } from './seed';

const SCHEMA = `
create table if not exists categories (
  id integer primary key,
  slug text unique not null,
  name text not null,
  sort integer not null default 0
);

create table if not exists products (
  id integer primary key,
  slug text unique not null,
  name text not null,
  variant text not null default '',
  subtitle text not null default '',
  sku text not null default '',
  category_id integer references categories(id),
  washes integer,
  description text not null default '',
  usage text not null default '',
  usage_note text not null default '',
  composition text not null default '',
  specs text not null default '[]',
  images text not null default '[]',
  price integer,
  old_price integer,
  stock integer not null default 0,
  wholesale_price integer,
  box_qty integer not null default 1,
  visible integer not null default 1,
  popular integer not null default 0,
  sort integer not null default 0,
  sales integer not null default 0,
  related text not null default '[]',
  search text not null default '',
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists companies (
  id integer primary key,
  inn text unique not null,
  kpp text not null default '',
  ogrn text not null default '',
  name text not null,
  address text not null default '',
  status text not null default '',
  created_at text not null default (datetime('now'))
);

create table if not exists users (
  id integer primary key,
  phone text unique not null,
  name text not null default '',
  email text not null default '',
  role text not null default 'customer',
  company_id integer references companies(id),
  position text not null default '',
  newsletter integer not null default 0,
  offer_accepted_at text,
  pd_consent_at text,
  created_at text not null default (datetime('now'))
);

create table if not exists sessions (
  id text primary key,
  user_id integer references users(id),
  promo_code text,
  created_at text not null default (datetime('now')),
  seen_at text not null default (datetime('now'))
);

create table if not exists otp_codes (
  id integer primary key,
  phone text not null,
  code_hash text not null,
  purpose text not null,
  payload text not null default '{}',
  attempts integer not null default 0,
  used integer not null default 0,
  created_at text not null default (datetime('now')),
  expires_at text not null
);
create index if not exists otp_phone on otp_codes(phone, created_at);

create table if not exists cart_items (
  owner text not null,
  mode text not null default 'retail',
  product_id integer not null references products(id) on delete cascade,
  qty integer not null,
  added_at text not null default (datetime('now')),
  primary key (owner, mode, product_id)
);

create table if not exists favorites (
  owner text not null,
  product_id integer not null references products(id) on delete cascade,
  added_at text not null default (datetime('now')),
  primary key (owner, product_id)
);

create table if not exists promo_codes (
  id integer primary key,
  code text unique not null,
  kind text not null check (kind in ('percent', 'fixed')),
  value integer not null,
  min_total integer not null default 0,
  starts_at text,
  ends_at text,
  usage_limit integer,
  once_per_customer integer not null default 0,
  used integer not null default 0,
  created_at text not null default (datetime('now'))
);

create table if not exists orders (
  id integer primary key,
  kind text not null default 'retail',
  status text not null default 'pending',
  user_id integer references users(id),
  company_id integer references companies(id),
  session_id text,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  delivery_type text not null default 'ozon',
  city text not null default '',
  pvz_id text not null default '',
  pvz_address text not null default '',
  pvz_hours text not null default '',
  delivery_cost integer not null default 0,
  delivery_eta text not null default '',
  items_total integer not null default 0,
  old_total integer not null default 0,
  discount integer not null default 0,
  promo_code text,
  total integer not null default 0,
  payment_method text not null default '',
  newsletter integer not null default 0,
  track text not null default '',
  storage_until text,
  paid_at text,
  received_at text,
  cart_hash text not null default '',
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);
create index if not exists orders_user on orders(user_id);
create index if not exists orders_session on orders(session_id);

create table if not exists order_items (
  id integer primary key,
  order_id integer not null references orders(id) on delete cascade,
  product_id integer,
  name text not null,
  variant text not null default '',
  image text not null default '',
  price integer not null,
  old_price integer,
  qty integer not null,
  box_qty integer not null default 1
);

create table if not exists order_events (
  id integer primary key,
  order_id integer not null references orders(id) on delete cascade,
  status text not null,
  at text not null default (datetime('now'))
);

create table if not exists payments (
  id integer primary key,
  order_id integer not null references orders(id) on delete cascade,
  provider text not null,
  external_id text not null default '',
  method text not null,
  amount integer not null,
  status text not null default 'pending',
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists promo_uses (
  promo_id integer not null references promo_codes(id) on delete cascade,
  customer text not null,
  order_id integer not null,
  primary key (promo_id, order_id)
);

create table if not exists documents (
  id integer primary key,
  order_id integer not null references orders(id) on delete cascade,
  kind text not null,
  number text not null,
  file text not null default '',
  created_at text not null default (datetime('now'))
);
`;

type Row = Record<string, any>;

class Db {
  raw: DatabaseSync;
  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new DatabaseSync(file);
    this.raw.exec('pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 3000;');
    this.raw.exec(SCHEMA);
  }
  all<T = Row>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.raw.prepare(sql).all(...params) as T[];
  }
  get<T = Row>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.raw.prepare(sql).get(...params) as T | undefined;
  }
  run(sql: string, ...params: SQLInputValue[]) {
    return this.raw.prepare(sql).run(...params);
  }
  value<T = any>(sql: string, ...params: SQLInputValue[]): T | undefined {
    const row = this.raw.prepare(sql).get(...params) as Row | undefined;
    return row ? (Object.values(row)[0] as T) : undefined;
  }
  tx<T>(fn: () => T): T {
    this.raw.exec('begin');
    try {
      const r = fn();
      this.raw.exec('commit');
      return r;
    } catch (e) {
      this.raw.exec('rollback');
      throw e;
    }
  }
}

const g = globalThis as unknown as { __paladaDb?: Db };

export function getDb(): Db {
  if (!g.__paladaDb) {
    const db = new Db(config.dbPath);
    if (!db.value<number>('select count(*) from categories')) seed(db);
    g.__paladaDb = db;
  }
  return g.__paladaDb;
}

export const db = new Proxy({} as Db, {
  get(_t, prop) {
    const d = getDb() as any;
    const v = d[prop];
    return typeof v === 'function' ? v.bind(d) : v;
  },
});

export type { Db };
