import { db } from './db';
import { shop, type ShopInfo } from './config';

// Настройки магазина из админки поверх значений по умолчанию (контакты из макетов).

export interface SettingDef {
  key: keyof ShopInfo;
  label: string;
  hint?: string;
  group: 'contacts' | 'legal' | 'bank' | 'notify';
  placeholder?: string;
}

export const SETTING_DEFS: SettingDef[] = [
  { key: 'wholesalePhone', label: 'Телефон для оптовых заказов', group: 'contacts', hint: 'В шапке и подвале сайта' },
  { key: 'supportPhone', label: 'Телефон поддержки', group: 'contacts', hint: 'Кнопка «Позвонить» и оформление заказа' },
  { key: 'whatsapp', label: 'WhatsApp', group: 'contacts', placeholder: '+7 918 818-17-22', hint: 'Номер для кнопки WhatsApp' },
  { key: 'legalName', label: 'Наименование', group: 'legal' },
  { key: 'inn', label: 'ИНН', group: 'legal' },
  { key: 'kpp', label: 'КПП', group: 'legal' },
  { key: 'ogrn', label: 'ОГРН', group: 'legal' },
  { key: 'address', label: 'Юридический адрес', group: 'legal' },
  { key: 'bankName', label: 'Банк', group: 'bank', placeholder: 'ПАО Сбербанк' },
  { key: 'bik', label: 'БИК', group: 'bank' },
  { key: 'corrAccount', label: 'Корр. счёт', group: 'bank' },
  { key: 'account', label: 'Расчётный счёт', group: 'bank' },
  { key: 'notifyEmail', label: 'Почта для уведомлений о заказах', group: 'notify', placeholder: 'orders@palada.shop', hint: 'Сюда придёт письмо о каждом оплаченном заказе и выставленном счёте' },
];

const DEFAULTS: Partial<ShopInfo> = { ...shop };
const digits = (s: string) => s.replace(/\D/g, '');

/** Применяет сохранённые настройки к объекту shop (вызывается на каждом запросе — это одна выборка). */
export function applySettings() {
  const rows = db.all<{ key: string; value: string }>('select key, value from settings');
  const saved = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  for (const d of SETTING_DEFS) {
    const v = saved[d.key];
    (shop as any)[d.key] = v !== undefined && v !== '' ? v : (DEFAULTS as any)[d.key];
  }
  // whatsapp в настройках — номер; на сайте нужна ссылка
  const wa = saved.whatsapp ? digits(saved.whatsapp) : '';
  if (wa) shop.whatsapp = `https://wa.me/${wa.startsWith('8') && wa.length === 11 ? '7' + wa.slice(1) : wa}`;
  shop.wholesaleTel = digits(shop.wholesalePhone) || (DEFAULTS.wholesaleTel as string);
  const sup = digits(shop.supportPhone);
  shop.supportTel = sup ? `+${sup.length === 11 && sup.startsWith('8') ? '7' + sup.slice(1) : sup}` : (DEFAULTS.supportTel as string);
}

export function settingValue(key: string): string {
  const v = db.value<string>('select value from settings where key = ?', key);
  if (v !== undefined && v !== '') return v;
  if (key === 'whatsapp') return '+' + String(DEFAULTS.whatsapp).replace(/\D/g, '');
  return String((DEFAULTS as any)[key] ?? '');
}

export function saveSettings(values: Record<string, string>) {
  db.tx(() => {
    for (const d of SETTING_DEFS) {
      if (!(d.key in values)) continue;
      db.run('insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value', d.key, String(values[d.key] ?? '').trim().slice(0, 300));
    }
  });
  applySettings();
}
