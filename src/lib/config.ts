import fs from 'node:fs';
import path from 'node:path';

// .env читаем сами: в production сервер запускается через `node dist/server/entry.mjs`,
// где Vite уже не подхватывает файл. Переменные окружения процесса имеют приоритет.
const envFile = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = (k: string) => (process.env[k] || '').trim();

// В собранном сервере Vite подставляет import.meta.env.PROD = true, независимо от NODE_ENV
export const isProd = import.meta.env.PROD || process.env.NODE_ENV === 'production';

export const config = {
  siteUrl: env('SITE_URL').replace(/\/$/, ''),
  dbPath: env('DB_PATH') || path.resolve(process.cwd(), 'data/palada.db'),
  uploadsDir: path.resolve(process.cwd(), 'data/uploads'),
  adminPhones: env('ADMIN_PHONES').split(',').map((p) => p.replace(/\D/g, '')).filter(Boolean),
  yookassa: {
    shopId: env('YOOKASSA_SHOP_ID'),
    secretKey: env('YOOKASSA_SECRET_KEY'),
    receipts: env('YOOKASSA_RECEIPTS') === 'true',
    vatCode: Number(env('YOOKASSA_VAT_CODE') || 1),
  },
  smsRuApiId: env('SMSRU_API_ID'),
  /** Публичное демо: код входа на экране, тестовая оплата, демо-данные. Не включать на боевом сайте. */
  demo: env('DEMO_MODE') === 'true',
  dadataKey: env('DADATA_API_KEY'),
};

/** Контакты и реквизиты — из макетов (palada.su). */
export const shop = {
  name: 'PALADA',
  legalName: 'ООО «АРМ»',
  inn: '0608050414',
  ogrn: '1180608003410',
  domain: 'palada.su',
  wholesalePhone: '8 (928) 021-19-49',
  wholesaleTel: '89280211949',
  supportPhone: '+7 918 818-17-22',
  supportTel: '+79188181722',
  whatsapp: 'https://wa.me/79188181722',
};

export const paymentsLive = () => Boolean(config.yookassa.shopId && config.yookassa.secretKey);
export const smsLive = () => Boolean(config.smsRuApiId);
