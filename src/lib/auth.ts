import crypto from 'node:crypto';
import { db } from './db';
import { config, isProd, smsLive } from './config';
import { phonePretty } from './format';

// Вход по коду из СМС. Код — 4 цифры, живёт 10 минут, 3 попытки, повторная отправка через 60 секунд.

export const CODE_TTL_MIN = 10;
export const RESEND_SEC = 60;
export const MAX_ATTEMPTS = 3;
const MAX_PER_HOUR = 5;

export type Purpose = 'login' | 'register' | 'b2b-register' | 'change-phone';

const hash = (phone: string, code: string) => crypto.createHash('sha256').update(`${phone}:${code}:palada`).digest('hex');

async function sendSms(phone: string, text: string) {
  if (!smsLive()) {
    console.log(`[sms:dev] ${phonePretty(phone)}: ${text}`);
    return;
  }
  const url = `https://sms.ru/sms/send?api_id=${encodeURIComponent(config.smsRuApiId)}&to=${phone}&msg=${encodeURIComponent(text)}&json=1`;
  const res = await fetch(url);
  const data: any = await res.json().catch(() => ({}));
  if (data.status !== 'OK') {
    console.error('[sms.ru] send failed', data);
    throw new Error('Не удалось отправить СМС. Попробуйте ещё раз через минуту.');
  }
}

export interface CodeResult {
  ok: boolean;
  error?: string;
  wait?: number;
  /** Только в режиме разработки без СМС-провайдера. */
  devCode?: string;
}

export async function requestCode(phone: string, purpose: Purpose, payload: object = {}): Promise<CodeResult> {
  const last = db.get<{ created_at: string }>('select created_at from otp_codes where phone = ? order by id desc limit 1', phone);
  if (last) {
    const ago = (Date.now() - new Date(last.created_at.replace(' ', 'T') + 'Z').getTime()) / 1000;
    if (ago < RESEND_SEC) return { ok: false, wait: Math.ceil(RESEND_SEC - ago), error: 'Код уже отправлен' };
  }
  const hourCount = db.value<number>(`select count(*) from otp_codes where phone = ? and created_at > datetime('now', '-1 hour')`, phone) || 0;
  if (hourCount >= MAX_PER_HOUR) return { ok: false, error: 'Слишком много попыток. Попробуйте через час.' };

  const code = String(crypto.randomInt(0, 10000)).padStart(4, '0');
  db.run(`update otp_codes set used = 1 where phone = ? and used = 0`, phone);
  db.run(
    `insert into otp_codes (phone, code_hash, purpose, payload, expires_at) values (?, ?, ?, ?, datetime('now', '+${CODE_TTL_MIN} minutes'))`,
    phone, hash(phone, code), purpose, JSON.stringify(payload),
  );
  await sendSms(phone, `PALADA: код для входа ${code}. Никому его не сообщайте.`);
  return { ok: true, wait: RESEND_SEC, devCode: !smsLive() && (!isProd || config.demo) ? code : undefined };
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
  left?: number;
  purpose?: Purpose;
  payload?: any;
}

export function verifyCode(phone: string, code: string): VerifyResult {
  const row = db.get<any>(`select * from otp_codes where phone = ? and used = 0 order by id desc limit 1`, phone);
  if (!row) return { ok: false, error: 'Код устарел — запросите новый' };
  if (new Date(row.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now()) {
    db.run('update otp_codes set used = 1 where id = ?', row.id);
    return { ok: false, error: 'Код устарел — запросите новый' };
  }
  if (row.code_hash !== hash(phone, code)) {
    const attempts = row.attempts + 1;
    const left = MAX_ATTEMPTS - attempts;
    db.run('update otp_codes set attempts = ?, used = ? where id = ?', attempts, left <= 0 ? 1 : 0, row.id);
    if (left <= 0) return { ok: false, left: 0, error: 'Попытки закончились — запросите новый код' };
    return { ok: false, left, error: `Неверный код — ${left === 1 ? 'осталась 1 попытка' : `осталось ${left} попытки`}` };
  }
  db.run('update otp_codes set used = 1 where id = ?', row.id);
  return { ok: true, purpose: row.purpose, payload: JSON.parse(row.payload || '{}') };
}

export function userByPhone(phone: string) {
  return db.get<any>('select * from users where phone = ?', phone);
}

export function roleForPhone(phone: string, current?: string): string {
  if (config.adminPhones.includes(phone)) return 'admin';
  return current || 'customer';
}
