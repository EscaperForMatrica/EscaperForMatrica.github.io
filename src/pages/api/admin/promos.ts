import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, str, bool, int } from '../../../lib/http';
import { normCode } from '../../../lib/promo';

const date = (v: unknown) => {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export const POST: APIRoute = async ({ request }) => {
  const b = await body(request);
  if (b.action === 'delete') {
    db.run('delete from promo_codes where id = ?', int(b.id));
    return json({ ok: true });
  }
  if (b.action !== 'save') return fail('Неизвестное действие');
  const code = normCode(str(b.code, 30));
  if (!/^[A-Z0-9]{3,30}$/.test(code)) return fail('Код — от 3 символов, только латиница и цифры');
  const kind = b.kind === 'fixed' ? 'fixed' : 'percent';
  const value = int(b.value);
  if (value <= 0 || (kind === 'percent' && value > 90)) return fail(kind === 'percent' ? 'Скидка — от 1 до 90%' : 'Укажите сумму скидки');
  const min = Math.max(0, int(b.min_total));
  const starts = date(b.starts_at);
  const ends = date(b.ends_at);
  if (starts && ends && ends < starts) return fail('Дата окончания раньше даты начала');
  const limitRaw = str(b.usage_limit, 10);
  const limit = limitRaw ? int(limitRaw) : null;
  if (limit !== null && limit <= 0) return fail('Лимит — положительное число или пусто');
  const id = int(b.id);
  const dup = db.value<number>('select id from promo_codes where code = ? and id != ?', code, id || 0);
  if (dup) return fail('Такой промокод уже есть');
  const once = bool(b.once_per_customer) ? 1 : 0;
  if (id) db.run('update promo_codes set code=?, kind=?, value=?, min_total=?, starts_at=?, ends_at=?, usage_limit=?, once_per_customer=? where id = ?', code, kind, value, min, starts, ends, limit, once, id);
  else db.run('insert into promo_codes (code, kind, value, min_total, starts_at, ends_at, usage_limit, once_per_customer) values (?,?,?,?,?,?,?,?)', code, kind, value, min, starts, ends, limit, once);
  return json({ ok: true });
};
