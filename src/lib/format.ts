const NB = ' ';

/** 1024 → «1 024 ₽» (неразрывные пробелы). */
export function rub(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '−' : '';
  return sign + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽';
}

export function num(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB);
}

export function discountPct(price: number | null, old: number | null): number {
  if (!price || !old || old <= price) return 0;
  return Math.round((1 - price / old) * 100);
}

/** Склонение: plural(5, ['товар', 'товара', 'товаров']). */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const goods = (n: number) => `${n} ${plural(n, ['товар', 'товара', 'товаров'])}`;

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];

/** SQLite хранит UTC «YYYY-MM-DD HH:MM:SS». */
export function parseDate(s: string | Date | null | undefined): Date | null {
  if (!s) return null;
  if (s instanceof Date) return s;
  return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
}

const TZ = 'Europe/Moscow';

function parts(d: Date) {
  const f = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month - 1, d: +p.day, hh: p.hour, mm: p.minute };
}

/** «12 октября» */
export function dayMonth(s: string | Date | null | undefined): string {
  const d = parseDate(s);
  if (!d) return '';
  const p = parts(d);
  return `${p.d} ${MONTHS[p.m]}`;
}

/** «16.10, 19:58» */
export function shortDateTime(s: string | Date | null | undefined): string {
  const d = parseDate(s);
  if (!d) return '';
  const p = parts(d);
  return `${String(p.d).padStart(2, '0')}.${String(p.m + 1).padStart(2, '0')}, ${p.hh}:${p.mm}`;
}

/** «17.10.2026» */
export function dateDots(s: string | Date | null | undefined): string {
  const d = parseDate(s);
  if (!d) return '';
  const p = parts(d);
  return `${String(p.d).padStart(2, '0')}.${String(p.m + 1).padStart(2, '0')}.${p.y}`;
}

/** «Сегодня, 19:42» / «Вчера, 10:05» / «12 октября, 19:42» */
export function humanDateTime(s: string | Date | null | undefined): string {
  const d = parseDate(s);
  if (!d) return '';
  const p = parts(d);
  const today = parts(new Date());
  const y = parts(new Date(Date.now() - 864e5));
  const time = `${p.hh}:${p.mm}`;
  if (p.y === today.y && p.m === today.m && p.d === today.d) return `Сегодня, ${time}`;
  if (p.y === y.y && p.m === y.m && p.d === y.d) return `Вчера, ${time}`;
  return `${p.d} ${MONTHS[p.m]}, ${time}`;
}

/** Диапазон доставки от сегодня: «19–21 окт.» */
export function etaRange(minDays: number, maxDays: number, from = new Date()): string {
  const a = parts(new Date(from.getTime() + minDays * 864e5));
  const b = parts(new Date(from.getTime() + maxDays * 864e5));
  if (a.m === b.m) return `${a.d}–${b.d} ${MONTHS_SHORT[b.m]}`;
  return `${a.d} ${MONTHS_SHORT[a.m]} – ${b.d} ${MONTHS_SHORT[b.m]}`;
}

/** «19–21 октября» для текста. */
export function etaRangeLong(minDays: number, maxDays: number, from = new Date()): string {
  const a = parts(new Date(from.getTime() + minDays * 864e5));
  const b = parts(new Date(from.getTime() + maxDays * 864e5));
  if (a.m === b.m) return `${a.d}–${b.d} ${MONTHS[b.m]}`;
  return `${a.d} ${MONTHS[a.m]} – ${b.d} ${MONTHS[b.m]}`;
}

export function monthName(m: number) {
  return ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][m];
}

// ── Телефоны ─────────────────────────────────────────────

/** Любой ввод → «79188181722» или '' если номер некорректный. */
export function normPhone(input: string): string {
  let d = (input || '').replace(/\D/g, '');
  if (d.length === 11 && (d[0] === '8' || d[0] === '7')) d = '7' + d.slice(1);
  else if (d.length === 10 && d[0] === '9') d = '7' + d;
  return /^79\d{9}$/.test(d) ? d : '';
}

/** «+7 (918) 818-17-22» */
export function phoneInput(p: string): string {
  const d = normPhone(p) || p.replace(/\D/g, '');
  if (d.length !== 11) return p;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
}

/** «+7 918 818-17-22» */
export function phonePretty(p: string): string {
  const d = normPhone(p);
  if (!d) return p;
  return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
}

/** «+7 918 ***-**-22» */
export function phoneMasked(p: string): string {
  const d = normPhone(p);
  if (!d) return p;
  return `+7 ${d.slice(1, 4)} ***-**-${d.slice(9)}`;
}

/** «+7 928 555-**-**» — для таблиц админки. */
export function phoneHalf(p: string): string {
  const d = normPhone(p);
  if (!d) return p;
  return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-**-**`;
}

/** «Петров Игорь Викторович» → «Петров И. В.» */
export function shortName(full: string): string {
  const [last, first, middle] = (full || '').trim().split(/\s+/);
  if (!last) return '';
  return [last, first ? first[0] + '.' : '', middle ? middle[0] + '.' : ''].filter(Boolean).join(' ');
}

/** «Иванова Анна Сергеевна» → «Анна Иванова» */
export function displayName(full: string): string {
  const [last, first] = (full || '').trim().split(/\s+/);
  if (!last) return '';
  return first ? `${first} ${last}` : last;
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || '').trim());
}

export function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
