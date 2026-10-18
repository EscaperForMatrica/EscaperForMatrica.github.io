import { defineMiddleware } from 'astro:middleware';
import { loadSession } from './lib/session';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const s = loadSession(ctx.cookies);
  ctx.locals.sid = s.sid;
  ctx.locals.user = s.user;
  ctx.locals.company = s.company;

  const path = ctx.url.pathname;
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    if (s.user?.role !== 'admin') {
      if (path.startsWith('/api/')) return new Response(JSON.stringify({ error: 'Нет доступа' }), { status: 403, headers: { 'content-type': 'application/json' } });
      return ctx.redirect(`/login?next=${encodeURIComponent(path + ctx.url.search)}`);
    }
  }
  const res = await next();
  if (path.startsWith('/api/') || path.startsWith('/admin') || path.startsWith('/account') || path.startsWith('/checkout')) {
    res.headers.set('cache-control', 'no-store');
  }
  return res;
});
