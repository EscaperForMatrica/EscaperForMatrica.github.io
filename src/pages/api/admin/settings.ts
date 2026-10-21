import type { APIRoute } from 'astro';
import { json, fail, body, str } from '../../../lib/http';
import { saveSettings, SETTING_DEFS } from '../../../lib/settings';
import { isEmail } from '../../../lib/format';
import { sendMail } from '../../../lib/mailer';
import { mailLive } from '../../../lib/config';

// Настройки магазина: save | test-mail
export const POST: APIRoute = async ({ request, locals }) => {
  const b = await body(request);
  if (b.action === 'test-mail') {
    const to = str(b.to, 120) || locals.user?.email || '';
    if (!isEmail(to)) return fail('Укажите почту для теста');
    try {
      await sendMail({ to, subject: 'Проверка почты PALADA', lines: ['Если вы читаете это письмо — отправка писем с сайта настроена правильно.'] });
    } catch (e: any) {
      return fail(`Письмо не отправлено: ${e?.message || e}`, 502);
    }
    return json({ ok: true, live: mailLive() });
  }
  const values: Record<string, string> = {};
  for (const d of SETTING_DEFS) if (d.key in b) values[d.key] = str(b[d.key], 300);
  if (values.notifyEmail && !values.notifyEmail.split(',').every((e) => isEmail(e.trim()))) return fail('Проверьте почту для уведомлений', 400, { field: 'notifyEmail' });
  saveSettings(values);
  return json({ ok: true });
};
