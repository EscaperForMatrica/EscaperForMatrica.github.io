import { defineMiddleware } from 'astro:middleware';
import { loadSession } from './lib/session';
import { applySettings } from './lib/settings';
import { config, isProd } from './lib/config';
import { db } from './lib/db';

// Политика безопасности по образцу helmet и OWASP Secure Headers. Все скрипты и шрифты — свои,
// внешних ресурсов нет; inline-стили нужны вёрстке (атрибуты style), inline-скриптов нет.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

function secure(res: Response, path: string, isAdmin: boolean) {
  const h = res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (isProd && !config.demo) {
    h.set('Strict-Transport-Security', 'max-age=31536000');
    if ((h.get('content-type') || '').includes('text/html')) h.set('Content-Security-Policy', CSP);
  }
  if (isAdmin || path.startsWith('/api/')) h.set('X-Robots-Tag', 'noindex, nofollow');
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  applySettings();
  const s = loadSession(ctx.cookies);
  ctx.locals.sid = s.sid;
  ctx.locals.user = s.user;
  ctx.locals.company = s.company;
  // Почта из ADMIN_EMAILS — администратор, даже если кабинет с ней раньше завели как покупательский
  if (s.user && s.user.role !== 'admin' && config.adminEmails.includes(s.user.email)) {
    db.run(`update users set role = 'admin' where id = ?`, s.user.id);
    s.user.role = 'admin';
  }

  const path = ctx.url.pathname;
  const under = (base: string) => path === base || path.startsWith(base + '/');
  const A = config.adminPath;
  // Страницы админки лежат в /admin, а открываются по секретному адресу A: снаружи /admin не существует
  if (A !== '/admin' && under('/admin')) return next('/404');
  const isAdmin = under(A);
  if (isAdmin || path.startsWith('/api/admin')) {
    if (s.user?.role !== 'admin') {
      if (path.startsWith('/api/')) return new Response(JSON.stringify({ error: 'Нет доступа' }), { status: 403, headers: { 'content-type': 'application/json' } });
      return ctx.redirect(`/login?next=${encodeURIComponent(path + ctx.url.search)}`);
    }
  }
  const res = await (isAdmin && A !== '/admin' ? next(new URL('/admin' + path.slice(A.length) + ctx.url.search, ctx.url)) : next());
  try {
    if (path.startsWith('/api/') || isAdmin || path.startsWith('/account') || path.startsWith('/checkout')) {
      res.headers.set('cache-control', 'no-store');
    }
    secure(res, path, isAdmin);
  } catch {
    // у части ответов (Response.redirect) заголовки неизменяемые — их оставляем как есть
  }
  return res;
});
