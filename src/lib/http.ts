export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}

export const fail = (error: string, status = 400, extra: object = {}) => json({ ok: false, error, ...extra }, status);

/** Тело запроса: JSON или форма. */
export async function body(request: Request): Promise<Record<string, any>> {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) return (await request.json().catch(() => ({}))) as Record<string, any>;
  if (ct.includes('form')) {
    const fd = await request.formData();
    const out: Record<string, any> = {};
    for (const [k, v] of fd.entries()) {
      if (k in out) out[k] = ([] as any[]).concat(out[k], v);
      else out[k] = v;
    }
    return out;
  }
  return {};
}

export const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);
export const int = (v: unknown, def = 0) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : def;
};
export const bool = (v: unknown) => v === true || v === 'true' || v === 'on' || v === '1' || v === 1;
