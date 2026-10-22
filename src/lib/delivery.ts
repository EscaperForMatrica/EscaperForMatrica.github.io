import { db } from './db';
import { shop } from './config';
import { etaRange } from './format';

// Доставка в пункты выдачи.
// Wildberries — настоящий справочник всех ПВЗ России из открытого файла, которым пользуется сам wildberries.ru;
// обновляется раз в сутки. Ozon отдаёт свои ПВЗ только продавцам с «Ozon Доставкой» через Seller API
// (v1/delivery/point/list, OAuth-токен) — пока этого нет, покупатель вписывает адрес пункта из приложения Ozon.
// Цены и сроки — из «Настроек» админки.

export type DeliveryType = 'ozon' | 'wb';

export interface Pvz {
  id: string;
  address: string;
  hours: string;
  lat: number | null;
  lon: number | null;
}

// Полная версия справочника (около 90 тысяч пунктов по России, ~50 МБ); all-poo-fr-v2 — неполная выборка
const WB_URL = 'https://static-basket-01.wbbasket.ru/vol0/data/all-poo-fr-v11.json';
const DAY_MS = 24 * 3600 * 1000;

const DEFAULTS = { ozon: { price: 99, days: [2, 4] }, wb: { price: 199, days: [3, 6] } } as const;

export function deliveryPrice(type: DeliveryType): number {
  const n = parseInt((type === 'wb' ? shop.wbPrice : shop.ozonPrice).replace(/\s/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULTS[type].price;
}

export function deliveryDays(type: DeliveryType): [number, number] {
  const m = (type === 'wb' ? shop.wbDays : shop.ozonDays).match(/\d+/g)?.map(Number) || [];
  if (!m.length) return [...DEFAULTS[type].days];
  return [m[0], Math.max(m[0], m[1] ?? m[0])];
}

/** «2–4 дня» для подписей в карточке товара и в выборе доставки. */
export function deliveryDaysLabel(type: DeliveryType): string {
  const [a, b] = deliveryDays(type);
  const n = b % 100;
  const word = n % 10 === 1 && n !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n < 12 || n > 14) ? 'дня' : 'дней';
  return `${a === b ? a : `${a}–${b}`} ${word}`;
}

export const deliveryEta = (type: DeliveryType) => {
  const [a, b] = deliveryDays(type);
  return etaRange(a, b);
};

/** Стоимость доставки. Для опта — по числу коробок (крупное отправление). */
export function deliveryCost(type: DeliveryType, boxes = 0): number {
  const base = deliveryPrice(type);
  return boxes ? Math.max(base, 150 + 30 * boxes) : base;
}

// ── Справочник ПВЗ Wildberries ──

const STOP = new Set(['ул', 'улица', 'дом', 'обл', 'область', 'край', 'город', 'пр', 'кт', 'проспект', 'пер', 'переулок', 'ш', 'шоссе', 'бульвар', 'пгт', 'респ', 'республика', 'корп', 'стр']);

export const normalize = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const meta = (key: string) => db.value<string>('select value from settings where key = ?', key) || '';
const setMeta = (key: string, value: string) =>
  db.run('insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value', key, value);

const DAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** «понедельник: 10:00-21:00, вторник: …» → «Ежедневно 10:00–21:00» или «Пн–Пт 09:00–21:00, Сб–Вс 10:00–18:00». */
export function hoursLabel(raw: string): string {
  const byDay: Record<string, string> = {};
  for (const part of raw.split(',')) {
    const m = part.trim().match(/^([а-яё]+):\s*(.+)$/i);
    if (m) byDay[m[1].toLowerCase()] = m[2].trim().replace(/(\d)-(\d)/g, '$1–$2');
  }
  const v = DAYS.map((d) => byDay[d]);
  if (v.some((x) => !x)) return raw.trim();
  if (v.every((x) => x === v[0])) return `Ежедневно ${v[0]}`;
  const out: string[] = [];
  for (let i = 0; i < 7; ) {
    let j = i;
    while (j < 6 && v[j + 1] === v[i]) j++;
    out.push(`${j > i ? `${DAYS_SHORT[i]}–${DAYS_SHORT[j]}` : DAYS_SHORT[i]} ${v[i]}`);
    i = j + 1;
  }
  return out.join(', ');
}

let loading: Promise<void> | null = null;

/** Загружает справочник WB, если его нет или он старше суток. Не ждёт загрузки — поиск работает по текущей версии. */
export function refreshPvzIfStale(): void {
  const updated = Number(meta('pvz_wb_updated')) || 0;
  if (loading || Date.now() - updated < DAY_MS) return;
  // Несколько процессов Passenger не должны качать файл одновременно: блокировка на 10 минут через базу
  db.run(`insert or ignore into settings (key, value) values ('pvz_wb_lock', '0')`);
  const now = Date.now();
  const got = db.run(`update settings set value = ? where key = 'pvz_wb_lock' and cast(value as integer) < ?`, String(now), now - 10 * 60 * 1000);
  if (!Number(got.changes)) return;
  loading = loadWb()
    .catch((e) => console.error('[pvz] справочник WB не обновлён:', e?.message || e))
    .finally(() => {
      loading = null;
      setMeta('pvz_wb_lock', '0');
    });
}

async function loadWb() {
  const res = await fetch(WB_URL, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ country: string; items: any[] }>;
  const items = data.find((c) => c.country === 'ru')?.items || [];
  if (items.length < 1000) throw new Error(`в файле всего ${items.length} пунктов`);
  const insert = db.raw.prepare('insert or replace into pvz (provider, id, address, search, hours, lat, lon) values (?, ?, ?, ?, ?, ?, ?)');
  db.tx(() => {
    db.run(`delete from pvz where provider = 'wb'`);
    for (const p of items) {
      const address = String(p.address || '').trim();
      if (!p.id || !address) continue;
      // В полной версии координаты — строка «[55.93, 37.51]»
      let coords: unknown = p.coordinates;
      if (typeof coords === 'string') {
        try {
          coords = JSON.parse(coords);
        } catch {
          coords = null;
        }
      }
      const [lat, lon] = Array.isArray(coords) ? coords.map(Number) : [null, null];
      insert.run('wb', String(p.id), address, normalize(address), hoursLabel(String(p.workTime || '')), lat, lon);
    }
  });
  setMeta('pvz_wb_updated', String(Date.now()));
  console.log(`[pvz] справочник WB обновлён: ${items.length} пунктов`);
}

/** Поиск ПВЗ Wildberries по городу и улице: все слова запроса должны встретиться в адресе. */
export function searchPvz(q: string, limit = 30): { points: Pvz[]; total: number; ready: boolean } {
  refreshPvzIfStale();
  const ready = Boolean(db.value(`select 1 from pvz where provider = 'wb' limit 1`));
  const words = normalize(q).split(' ').filter((w) => w.length >= 2 && !STOP.has(w)).slice(0, 6);
  if (!ready || !words.length) return { points: [], total: 0, ready };
  const where = words.map(() => `search like ?`).join(' and ');
  const params = words.map((w) => `%${w}%`);
  const total = db.value<number>(`select count(*) from pvz where provider = 'wb' and ${where}`, ...params) || 0;
  const points = db.all<Pvz>(
    `select id, address, hours, lat, lon from pvz where provider = 'wb' and ${where} order by instr(search, ?), address limit ?`,
    ...params, words[0], limit,
  );
  return { points, total, ready };
}

export function getPvz(id: string): Pvz | undefined {
  return db.get<Pvz>(`select id, address, hours, lat, lon from pvz where provider = 'wb' and id = ?`, id);
}

export type ChosenDelivery =
  | { ok: true; type: DeliveryType; pvzId: string; address: string; hours: string }
  | { ok: false; error: string; field: 'pvz' | 'wb' };

/** Пункт выдачи из формы оформления: WB — по id из справочника, Ozon — адрес, который вписал покупатель. */
export function chosenDelivery(b: Record<string, any>): ChosenDelivery {
  if (b.delivery_type === 'wb') {
    const p = getPvz(String(b.pvz_id ?? '').trim().slice(0, 40));
    if (!p) return { ok: false, error: 'Выберите пункт выдачи Wildberries из списка', field: 'wb' };
    return { ok: true, type: 'wb', pvzId: p.id, address: p.address, hours: p.hours };
  }
  const address = String(b.ozon_address ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (address.length < 10) return { ok: false, error: 'Укажите адрес пункта выдачи Ozon с городом и улицей', field: 'pvz' };
  return { ok: true, type: 'ozon', pvzId: '', address, hours: '' };
}

/** Ссылка «на карте» — Яндекс Карты с меткой. */
export const mapUrl = (p: Pick<Pvz, 'lat' | 'lon'>) => (p.lat && p.lon ? `https://yandex.ru/maps/?pt=${p.lon},${p.lat}&z=17&l=map` : '');
