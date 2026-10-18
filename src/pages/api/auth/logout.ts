import type { APIRoute } from 'astro';
import { signOut } from '../../../lib/session';

export const POST: APIRoute = ({ cookies, locals, redirect }) => {
  signOut(cookies, locals);
  return redirect('/', 303);
};
