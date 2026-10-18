import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { syncPayment, type Payment } from '../../../lib/payments';

// Уведомления ЮKassa (payment.succeeded / payment.canceled). Статус перепроверяем запросом к API,
// поэтому подделать уведомление нельзя. Укажите URL https://<домен>/api/payments/yookassa в кабинете ЮKassa.
export const POST: APIRoute = async ({ request }) => {
  const data: any = await request.json().catch(() => ({}));
  const id = data?.object?.id;
  if (typeof id !== 'string') return new Response('ok');
  const p = db.get<Payment>('select * from payments where provider = ? and external_id = ?', 'yookassa', id);
  if (p) await syncPayment(p);
  return new Response('ok');
};
