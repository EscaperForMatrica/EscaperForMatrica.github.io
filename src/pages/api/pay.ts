import type { APIRoute } from 'astro';
import { json, fail, body, int } from '../../lib/http';
import { getOrder, canView } from '../../lib/orders';
import { startPayment } from '../../lib/payments';

export const POST: APIRoute = async ({ request, locals, url }) => {
  const b = await body(request);
  const order = getOrder(int(b.orderId));
  if (!order || !canView(order, locals)) return fail('Заказ не найден', 404);
  if (order.status !== 'pending') return json({ ok: true, redirect: `/order/${order.id}` });
  const method = b.method === 'sbp' ? 'sbp' : 'card';
  try {
    const redirect = await startPayment(order, method, url.origin);
    return json({ ok: true, redirect });
  } catch (e: any) {
    return fail(e.message || 'Платёжный сервис недоступен', 502);
  }
};
