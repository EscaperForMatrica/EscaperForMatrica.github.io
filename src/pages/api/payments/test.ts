import type { APIRoute } from 'astro';
import { paymentsLive, isProd, config } from '../../../lib/config';
import { body, int, fail } from '../../../lib/http';
import { getPayment, settle } from '../../../lib/payments';
import { getOrder, canView } from '../../../lib/orders';

// Тестовый платёжный шлюз (только без ключей ЮKassa и не в production).
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (paymentsLive() || (isProd && !config.demo)) return fail('Тестовая оплата отключена', 404);
  const b = await body(request);
  const p = getPayment(int(b.payment));
  const order = p ? getOrder(p.order_id) : undefined;
  if (!p || !order || !canView(order, locals)) return fail('Платёж не найден', 404);
  settle(p.id, b.result === 'success' ? 'succeeded' : 'canceled');
  return redirect(`/order/${order.id}?payment=${p.id}`, 303);
};
