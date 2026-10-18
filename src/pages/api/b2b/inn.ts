import type { APIRoute } from 'astro';
import { json, fail } from '../../../lib/http';
import { validInn, lookupInn, STATUS_LABEL } from '../../../lib/inn';

export const GET: APIRoute = async ({ url }) => {
  const inn = (url.searchParams.get('inn') || '').replace(/\D/g, '');
  if (!validInn(inn)) return fail('Проверьте ИНН: 10 цифр для организации или 12 для ИП', 400);
  try {
    const c = await lookupInn(inn);
    if (!c) return fail('Компания с таким ИНН не найдена', 404);
    return json({ ok: true, company: { ...c, statusLabel: STATUS_LABEL[c.status] || c.status, active: c.status === 'ACTIVE' } });
  } catch (e: any) {
    return fail(e.message || 'Сервис проверки ИНН недоступен', 502);
  }
};
