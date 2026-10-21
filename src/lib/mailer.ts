import { config, mailLive, shop } from './config';
import { esc } from './format';

// Письма: SMTP через nodemailer (SMTP_HOST/SMTP_FROM в .env). Без настроек письмо пишется в лог сервера.

export interface Mail {
  to: string;
  subject: string;
  /** Абзацы письма; строки начинающиеся с «http» станут кнопкой-ссылкой. */
  lines: string[];
  code?: string;
}

let transport: any = null;

async function getTransport() {
  if (transport) return transport;
  const nodemailer: any = await import('nodemailer');
  transport = (nodemailer.default || nodemailer).createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transport;
}

/** Простой HTML в цветах магазина. */
function render(m: Mail): { html: string; text: string } {
  const parts = m.lines.map((l) =>
    l.startsWith('http')
      ? `<p style="margin:24px 0"><a href="${esc(l)}" style="display:inline-block;background:#15aea9;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px">Открыть</a></p>`
      : `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#2d3748">${esc(l)}</p>`,
  );
  const code = m.code
    ? `<p style="margin:16px 0 24px;font-size:36px;letter-spacing:.3em;font-weight:700;color:#1f3a5f">${esc(m.code)}</p>`
    : '';
  const html = `<!doctype html><html lang="ru"><body style="margin:0;background:#f7f9fa;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
<div style="font-size:20px;font-weight:700;color:#2d3748;margin-bottom:24px">PALADA</div>
<div style="background:#fff;border-radius:8px;padding:32px;box-shadow:0 4px 20px rgba(0,11,48,.08)">${code}${parts.join('')}</div>
<p style="font-size:13px;color:#64748b;margin-top:24px">${esc(shop.legalName)} · ${esc(shop.supportPhone)} · ${esc(shop.domain)}</p>
</div></body></html>`;
  const text = [m.code ? `Код: ${m.code}` : '', ...m.lines].filter(Boolean).join('\n\n');
  return { html, text };
}

export async function sendMail(m: Mail): Promise<void> {
  if (!m.to) return;
  if (!mailLive()) {
    console.log(`[mail:dev] → ${m.to}: ${m.subject}${m.code ? ` · код ${m.code}` : ''}`);
    return;
  }
  const { html, text } = render(m);
  const t = await getTransport();
  await t.sendMail({ from: config.smtp.from, to: m.to, subject: m.subject, html, text });
}

/** Отправка без ожидания: ошибки почты не должны ломать оформление заказа. */
export function sendMailLater(m: Mail) {
  sendMail(m).catch((e) => console.error('[mail] не отправлено:', m.subject, e?.message || e));
}
