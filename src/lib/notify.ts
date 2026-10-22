import { shop, config, adminUrl } from './config';
import { getOrder, orderItems, PAY_METHOD } from './orders';
import { rub } from './format';
import { sendMailLater } from './mailer';

// Письма о заказах. Отправляются в фоне: ошибка почты не мешает покупке.

const site = () => config.siteUrl || `https://${shop.domain}`;
const shopEmails = () => shop.notifyEmail.split(',').map((e) => e.trim()).filter(Boolean);
const delivery = (o: NonNullable<ReturnType<typeof getOrder>>) =>
  `${o.delivery_type === 'wb' ? 'ПВЗ Wildberries' : 'ПВЗ Ozon'}: ${o.delivery_type === 'ozon' && o.city ? `г. ${o.city}, ` : ''}${o.pvz_address}`;

export function notifyOrderPaid(orderId: number) {
  const o = getOrder(orderId);
  if (!o) return;
  const items = orderItems(o.id).map((i) => `${i.name}, ${i.variant} × ${i.qty} — ${rub(i.price * i.qty)}`);
  sendMailLater({
    to: o.email,
    subject: `Заказ № ${o.id} оплачен`,
    lines: [`Спасибо! Заказ № ${o.id} на ${rub(o.total)} оплачен.`, ...items, delivery(o), 'Мы соберём заказ на заводе и пришлём трек-номер, когда передадим его в доставку.', `${site()}/account/orders`],
  });
  for (const to of shopEmails()) {
    sendMailLater({
      to,
      subject: `Новый заказ № ${o.id} на ${rub(o.total)}`,
      lines: [`${o.name}, ${o.email}${o.phone ? `, +${o.phone}` : ''}`, `Оплата: ${PAY_METHOD[o.payment_method] || o.payment_method}`, ...items, delivery(o), `${site()}${adminUrl(`/orders?m=&id=${o.id}`)}`],
    });
  }
}

export function notifyTrack(orderId: number) {
  const o = getOrder(orderId);
  if (!o || !o.track) return;
  sendMailLater({
    to: o.email,
    subject: `Заказ № ${o.id} передан в доставку`,
    lines: [`Трек-номер: ${o.track}`, `Отследить посылку можно в приложении ${o.delivery_type === 'wb' ? 'Wildberries' : 'Ozon'}.`, delivery(o), `${site()}/account/orders`],
  });
}

export function notifyInvoice(orderId: number) {
  const o = getOrder(orderId);
  if (!o) return;
  sendMailLater({
    to: o.email,
    subject: `Счёт № ${o.id} на ${rub(o.total)}`,
    lines: [`Счёт № ${o.id} на оплату оптового заказа выставлен. Заказ уйдёт в сборку после поступления оплаты.`, `${site()}/b2b/invoice/${o.id}`],
  });
  for (const to of shopEmails()) {
    sendMailLater({ to, subject: `Выставлен счёт № ${o.id} на ${rub(o.total)}`, lines: [`${o.name}, ${o.email}`, `${site()}${adminUrl(`/orders?m=&id=${o.id}`)}`] });
  }
}
