import { config, isProd } from './config';

// Реквизиты по ИНН: DaData (если задан DADATA_API_KEY), иначе — тестовые данные для разработки.

export interface CompanyInfo {
  inn: string;
  kpp: string;
  ogrn: string;
  name: string;
  address: string;
  status: 'ACTIVE' | 'LIQUIDATING' | 'LIQUIDATED' | 'BANKRUPT' | 'REORGANIZING' | string;
  type: 'LEGAL' | 'INDIVIDUAL';
}

/** Проверка контрольных цифр ИНН (10 — организация, 12 — ИП). */
export function validInn(inn: string): boolean {
  if (!/^\d{10}$|^\d{12}$/.test(inn)) return false;
  const d = inn.split('').map(Number);
  const check = (w: number[]) => (w.reduce((s, k, i) => s + k * d[i], 0) % 11) % 10;
  if (inn.length === 10) return check([2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[9];
  return check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[10] && check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[11];
}

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Действующая',
  LIQUIDATING: 'Ликвидируется',
  LIQUIDATED: 'Ликвидирована',
  BANKRUPT: 'Банкротство',
  REORGANIZING: 'Реорганизация',
};

export async function lookupInn(inn: string): Promise<CompanyInfo | null> {
  if (config.dadataKey) {
    const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Token ${config.dadataKey}` },
      body: JSON.stringify({ query: inn, count: 1 }),
    });
    if (!res.ok) throw new Error('Сервис проверки ИНН недоступен');
    const data: any = await res.json();
    const s = data.suggestions?.[0];
    if (!s) return null;
    return {
      inn,
      kpp: s.data.kpp || '',
      ogrn: s.data.ogrn || '',
      name: s.value,
      address: s.data.address?.value || '',
      status: s.data.state?.status || 'ACTIVE',
      type: s.data.type === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'LEGAL',
    };
  }
  const legal = inn.length === 10;
  // Без DaData на боевом сайте ничего не выдумываем: только ИНН, остальное — в карточке компании в админке
  if (isProd && !config.demo) {
    return { inn, kpp: '', ogrn: '', name: `${legal ? 'Организация' : 'ИП'}, ИНН ${inn}`, address: '', status: 'ACTIVE', type: legal ? 'LEGAL' : 'INDIVIDUAL' };
  }
  // Разработка и демо: детерминированные тестовые реквизиты
  const region = inn.slice(0, 4);
  return {
    inn,
    kpp: legal ? `${region}01001` : '',
    ogrn: legal ? `11${inn.slice(2, 4)}${inn.slice(0, 9)}` : `3${inn.slice(0, 12)}00`.slice(0, 15),
    name: legal ? (inn === '6164000000' ? 'ООО «Чистый дом»' : `ООО «Компания ${inn.slice(-4)}»`) : `ИП Тестовый ${inn.slice(-4)}`,
    address: 'г. Ростов-на-Дону, ул. Примерная, 1',
    status: 'ACTIVE',
    type: legal ? 'LEGAL' : 'INDIVIDUAL',
  };
}
