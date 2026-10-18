import type { APIRoute } from 'astro';
import { json, fail, body, str, bool } from '../../../lib/http';
import { normPhone, isEmail } from '../../../lib/format';
import { requestCode, userByPhone, type Purpose } from '../../../lib/auth';
import { validInn } from '../../../lib/inn';
import { ensureSession } from '../../../lib/session';
import { config } from '../../../lib/config';

// Шаг 1 входа/регистрации: проверяем поля и отправляем код по СМС.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const b = await body(request);
  const phone = normPhone(str(b.phone, 40));
  if (!phone) return fail('Проверьте номер телефона', 400, { field: 'phone' });
  const purpose = (['login', 'register', 'b2b-register', 'change-phone'].includes(b.purpose) ? b.purpose : 'login') as Purpose;
  const existing = userByPhone(phone);
  let payload: Record<string, unknown> = {};

  // Номер из ADMIN_PHONES может войти и без предварительной регистрации
  if (purpose === 'login' && !existing && !config.adminPhones.includes(phone)) {
    return fail('Кабинет с этим номером не найден. Зарегистрируйтесь — это займёт минуту.', 404, { field: 'phone', register: true });
  }
  if (purpose === 'register' || purpose === 'b2b-register') {
    const name = str(b.name, 120);
    const email = str(b.email, 120).toLowerCase();
    if (name.split(/\s+/).filter(Boolean).length < 2) return fail('Укажите фамилию и имя', 400, { field: 'name' });
    if (!isEmail(email)) return fail('Проверьте адрес почты', 400, { field: 'email' });
    if (!bool(b.offer) || !bool(b.pd)) return fail('Отметьте обязательные согласия', 400, { field: bool(b.offer) ? 'pd' : 'offer' });
    payload = { name, email, newsletter: bool(b.newsletter) };
    if (purpose === 'register' && existing) return fail('Этот номер уже зарегистрирован — войдите по коду', 409, { field: 'phone', login: true });
    if (purpose === 'b2b-register') {
      const inn = str(b.inn, 12).replace(/\D/g, '');
      if (!validInn(inn)) return fail('Проверьте ИНН', 400, { field: 'inn' });
      payload = { ...payload, inn, position: str(b.position, 80) };
      if (existing?.company_id) return fail('Этот номер уже привязан к компании — войдите по коду', 409, { field: 'phone', login: true });
    }
  }
  if (purpose === 'change-phone') {
    if (!locals.user) return fail('Войдите в кабинет', 401);
    if (existing) return fail('Этот номер уже используется', 409, { field: 'phone' });
    payload = { userId: locals.user.id };
  }

  ensureSession(cookies, locals);
  try {
    const r = await requestCode(phone, purpose, payload);
    if (!r.ok) return json({ ok: false, error: r.error, wait: r.wait }, 429);
    return json({ ok: true, wait: r.wait, devCode: r.devCode });
  } catch (e: any) {
    return fail(e.message || 'Не удалось отправить СМС', 502);
  }
};
