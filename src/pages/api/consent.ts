import type { APIRoute } from 'astro';
import { json } from '../../lib/http';

// Согласие с cookie-баннером
export const POST: APIRoute = ({ cookies }) => {
  cookies.set('cookie_ok', '1', { path: '/', maxAge: 31536000, sameSite: 'lax' });
  return json({ ok: true });
};
