import type { APIRoute } from 'astro';
import { json, fail, body, str, bool } from '../../../lib/http';
import { normPhone, isEmail } from '../../../lib/format';
import { requestCode, userByEmail, normEmail, type Purpose } from '../../../lib/auth';
import { validInn } from '../../../lib/inn';
import { ensureSession } from '../../../lib/session';
import { config } from '../../../lib/config';

// Шаг 1 входа/регистрации: проверяем поля и отправляем код на почту.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const b = await body(request);
  const email = normEmail(str(b.email, 120));
  if (!isEmail(email)) return fail('Проверьте адрес почты', 400, { field: 'email' });
  const purpose = (['login', 'register', 'b2b-register', 'change-email'].includes(b.purpose) ? b.purpose : 'login') as Purpose;
  const existing = userByEmail(email);
  let payload: Record<string, unknown> = {};

  // Почта из ADMIN_EMAILS может войти и без предварительной регистрации
  if (purpose === 'login' && !existing && !config.adminEmails.includes(email)) {
    return fail('Кабинет с этой почтой не найден. Зарегистрируйтесь — это займёт минуту.', 404, { field: 'email', register: true });
  }
  if (purpose === 'register' || purpose === 'b2b-register') {
    const name = str(b.name, 120);
    const rawPhone = str(b.phone, 40);
    const phone = rawPhone ? normPhone(rawPhone) : '';
    if (name.split(/\s+/).filter(Boolean).length < 2) return fail('Укажите фамилию и имя', 400, { field: 'name' });
    if (rawPhone && !phone) return fail('Проверьте номер телефона', 400, { field: 'phone' });
    if (!bool(b.offer) || !bool(b.pd)) return fail('Отметьте обязательные согласия', 400, { field: bool(b.offer) ? 'pd' : 'offer' });
    payload = { name, phone, newsletter: bool(b.newsletter) };
    if (purpose === 'register' && existing) return fail('Эта почта уже зарегистрирована — войдите по коду', 409, { field: 'email', login: true });
    if (purpose === 'b2b-register') {
      const inn = str(b.inn, 12).replace(/\D/g, '');
      if (!validInn(inn)) return fail('Проверьте ИНН', 400, { field: 'inn' });
      payload = { ...payload, inn, position: str(b.position, 80) };
      if (existing?.company_id) return fail('Эта почта уже привязана к компании — войдите по коду', 409, { field: 'email', login: true });
    }
  }
  if (purpose === 'change-email') {
    if (!locals.user) return fail('Войдите в кабинет', 401);
    if (existing) return fail('Эта почта уже используется', 409, { field: 'email' });
    payload = { userId: locals.user.id };
  }

  ensureSession(cookies, locals);
  try {
    const r = await requestCode(email, purpose, payload);
    if (!r.ok) return json({ ok: false, error: r.error, wait: r.wait }, 429);
    return json({ ok: true, wait: r.wait, devCode: r.devCode });
  } catch (e: any) {
    return fail(e.message || 'Не удалось отправить письмо', 502);
  }
};
