import { defineMiddleware } from 'astro:middleware';
import { loadSession } from './lib/session';
import { applySettings } from './lib/settings';
import { config } from './lib/config';
import { db } from './lib/db';

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
  if (path.startsWith('/api/') || isAdmin || path.startsWith('/account') || path.startsWith('/checkout')) {
    res.headers.set('cache-control', 'no-store');
  }
  return res;
});
