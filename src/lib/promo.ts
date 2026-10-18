import { db } from './db';
import { rub } from './format';

export interface Promo {
  id: number;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  min_total: number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  once_per_customer: number;
  used: number;
  created_at: string;
}

export const normCode = (s: string) => (s || '').trim().toUpperCase().replace(/\s+/g, '');

export function findPromo(code: string): Promo | undefined {
  return db.get<Promo>('select * from promo_codes where code = ?', normCode(code));
}

const today = () => new Date().toISOString().slice(0, 10);

export type PromoState = 'active' | 'expired' | 'scheduled' | 'exhausted';

export function promoState(p: Promo): PromoState {
  const d = today();
  if (p.ends_at && p.ends_at < d) return 'expired';
  if (p.starts_at && p.starts_at > d) return 'scheduled';
  if (p.usage_limit !== null && p.used >= p.usage_limit) return 'exhausted';
  return 'active';
}

export function promoLabel(p: Promo): string {
  return p.kind === 'percent' ? `скидка ${p.value}%` : `скидка ${rub(p.value)}`;
}

export interface PromoResult {
  promo?: Promo;
  discount: number;
  error?: string;
}

/** customer — «u:<id>» или телефон; нужен для правила «один раз на покупателя». */
export function evaluatePromo(code: string | null | undefined, itemsTotal: number, customer?: string[]): PromoResult {
  if (!code) return { discount: 0 };
  const p = findPromo(code);
  if (!p || promoState(p) !== 'active') return { discount: 0, error: 'Промокод недействителен' };
  if (itemsTotal < p.min_total) return { promo: p, discount: 0, error: `Минимальная сумма заказа — ${rub(p.min_total)}` };
  if (p.once_per_customer && customer?.length) {
    const used = db.value<number>(
      `select count(*) from promo_uses where promo_id = ? and customer in (${customer.map(() => '?').join(',')})`,
      p.id, ...customer,
    );
    if (used) return { promo: p, discount: 0, error: 'Вы уже использовали этот промокод' };
  }
  const discount = p.kind === 'percent' ? Math.floor((itemsTotal * p.value) / 100) : Math.min(p.value, itemsTotal);
  return { promo: p, discount };
}

export function promoDateRange(p: Promo): string {
  const f = (s: string) => s.split('-').reverse().join('.');
  if (p.starts_at && p.ends_at) return `${f(p.starts_at).slice(0, 5)}–${f(p.ends_at)}`;
  if (p.ends_at) return `до ${f(p.ends_at)}`;
  if (p.starts_at) return `с ${f(p.starts_at)}`;
  return 'бессрочно';
}
