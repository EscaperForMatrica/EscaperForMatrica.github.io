import crypto from 'node:crypto';
import { db } from './db';
import { config, isProd, mailLive } from './config';
import { sendMail } from './mailer';

// Вход по коду из письма. Код — 4 цифры, живёт 10 минут, 3 попытки, повторная отправка через 60 секунд.

export const CODE_TTL_MIN = 10;
export const RESEND_SEC = 60;
export const MAX_ATTEMPTS = 3;
const MAX_PER_HOUR = 5;

export type Purpose = 'login' | 'register' | 'b2b-register' | 'change-email';

export const normEmail = (s: string) => (s || '').trim().toLowerCase();
const hash = (email: string, code: string) => crypto.createHash('sha256').update(`${email}:${code}:palada`).digest('hex');

export interface CodeResult {
  ok: boolean;
  error?: string;
  wait?: number;
  /** Только в разработке и демо, пока не настроена почта. */
  devCode?: string;
}

const SUBJECT: Record<Purpose, string> = {
  login: 'Код для входа в PALADA',
  register: 'Код для регистрации в PALADA',
  'b2b-register': 'Код для регистрации компании в PALADA',
  'change-email': 'Подтвердите новую почту в PALADA',
};

/** С одного IP — не больше 10 кодов в час на любые адреса: чтобы сайтом не засыпали письмами чужие ящики. */
const MAX_PER_IP_HOUR = 10;

export async function requestCode(email: string, purpose: Purpose, payload: object = {}, ip = ''): Promise<CodeResult> {
  const last = db.get<{ created_at: string }>('select created_at from otp_codes where email = ? order by id desc limit 1', email);
  if (last) {
    const ago = (Date.now() - new Date(last.created_at.replace(' ', 'T') + 'Z').getTime()) / 1000;
    if (ago < RESEND_SEC) return { ok: false, wait: Math.ceil(RESEND_SEC - ago), error: 'Код уже отправлен' };
  }
  const hourCount = db.value<number>(`select count(*) from otp_codes where email = ? and created_at > datetime('now', '-1 hour')`, email) || 0;
  if (hourCount >= MAX_PER_HOUR) return { ok: false, error: 'Слишком много попыток. Попробуйте через час.' };
  if (ip) {
    const ipCount = db.value<number>(`select count(*) from otp_codes where ip = ? and created_at > datetime('now', '-1 hour')`, ip) || 0;
    if (ipCount >= MAX_PER_IP_HOUR) return { ok: false, error: 'Слишком много попыток. Попробуйте через час.' };
  }

  const code = String(crypto.randomInt(0, 10000)).padStart(4, '0');
  db.run(`update otp_codes set used = 1 where email = ? and used = 0`, email);
  db.run(
    `insert into otp_codes (email, code_hash, purpose, payload, ip, expires_at) values (?, ?, ?, ?, ?, datetime('now', '+${CODE_TTL_MIN} minutes'))`,
    email, hash(email, code), purpose, JSON.stringify(payload), ip,
  );
  try {
    await sendMail({
      to: email,
      subject: SUBJECT[purpose],
      code,
      lines: [`Введите этот код на сайте. Он действует ${CODE_TTL_MIN} минут.`, 'Если вы не запрашивали код, просто проигнорируйте письмо.'],
    });
  } catch (e: any) {
    console.error('[mail] код не отправлен', e?.message || e);
    throw new Error('Не удалось отправить письмо. Проверьте адрес или попробуйте через минуту.');
  }
  return { ok: true, wait: RESEND_SEC, devCode: !mailLive() && (!isProd || config.demo) ? code : undefined };
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
  left?: number;
  purpose?: Purpose;
  payload?: any;
}

export function verifyCode(email: string, code: string): VerifyResult {
  const row = db.get<any>(`select * from otp_codes where email = ? and used = 0 order by id desc limit 1`, email);
  if (!row) return { ok: false, error: 'Код устарел — запросите новый' };
  if (new Date(row.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now()) {
    db.run('update otp_codes set used = 1 where id = ?', row.id);
    return { ok: false, error: 'Код устарел — запросите новый' };
  }
  if (row.code_hash !== hash(email, code)) {
    const attempts = row.attempts + 1;
    const left = MAX_ATTEMPTS - attempts;
    db.run('update otp_codes set attempts = ?, used = ? where id = ?', attempts, left <= 0 ? 1 : 0, row.id);
    if (left <= 0) return { ok: false, left: 0, error: 'Попытки закончились — запросите новый код' };
    return { ok: false, left, error: `Неверный код — ${left === 1 ? 'осталась 1 попытка' : `осталось ${left} попытки`}` };
  }
  db.run('update otp_codes set used = 1 where id = ?', row.id);
  return { ok: true, purpose: row.purpose, payload: JSON.parse(row.payload || '{}') };
}

export function userByEmail(email: string) {
  return db.get<any>('select * from users where email = ?', normEmail(email));
}

/** Почта из ADMIN_EMAILS всегда получает роль администратора. */
export function roleForEmail(email: string, current?: string): string {
  if (config.adminEmails.includes(normEmail(email))) return 'admin';
  return current || 'customer';
}
