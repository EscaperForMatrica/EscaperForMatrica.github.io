// Общие сценарии витрины: корзина, избранное, cookie, меню, селекты, модальные окна.

export async function api<T = any>(url: string, data?: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: data instanceof FormData ? {} : { 'content-type': 'application/json' },
    body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data),
    credentials: 'same-origin',
  });
  const out = await res.json().catch(() => ({ ok: false, error: 'Сервер не ответил. Попробуйте ещё раз.' }));
  if (!res.ok && out.ok === undefined) out.ok = false;
  return out as T;
}

export function toast(text: string, kind: 'info' | 'error' = 'info') {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = `pl-note toast ${kind === 'error' ? 'pl-note--error' : ''}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `<i class="ic ic-${kind === 'error' ? 'alert' : 'check'}"></i><span></span>`;
  el.querySelector('span')!.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

/** Перерисовать фрагменты страницы свежим HTML с сервера (вместо клиентского шаблонизатора). */
export async function swap(...selectors: string[]) {
  const res = await fetch(location.href, { credentials: 'same-origin', headers: { 'x-swap': '1' } });
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const sel of selectors) {
    const fresh = doc.querySelectorAll(sel);
    const cur = document.querySelectorAll(sel);
    cur.forEach((el, i) => {
      if (fresh[i]) el.replaceWith(fresh[i]);
    });
  }
  document.dispatchEvent(new CustomEvent('swapped'));
}

export function setCartCount(n: number) {
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((el) => {
    el.textContent = String(n);
    el.hidden = !n;
  });
}

// ── Корзина из карточек и страницы товара ────────────────
function inCartButton(btn: HTMLElement) {
  const a = document.createElement('a');
  a.className = btn.className.replace('pl-btn--primary', 'pl-btn--secondary');
  a.href = btn.dataset.cartHref || '/cart';
  a.innerHTML = '<i class="ic ic-check ic-18"></i>В корзине';
  btn.replaceWith(a);
}

document.addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;

  const add = t.closest<HTMLButtonElement>('[data-add]');
  if (add) {
    e.preventDefault();
    if (add.classList.contains('is-loading')) return;
    const qtyInput = add.dataset.qtyFrom ? document.querySelector<HTMLInputElement>(add.dataset.qtyFrom) : null;
    const qty = qtyInput ? Number(qtyInput.value) || 1 : Number(add.dataset.qty || 1);
    add.classList.add('is-loading');
    const r = await api('/api/cart', { action: 'add', id: Number(add.dataset.add), qty });
    add.classList.remove('is-loading');
    if (!r.ok) return toast(r.error || 'Не удалось добавить товар', 'error');
    setCartCount(r.count);
    if (add.dataset.keep === undefined) inCartButton(add);
    else toast('Товар в корзине');
    return;
  }

  const fav = t.closest<HTMLButtonElement>('[data-fav]');
  if (fav) {
    e.preventDefault();
    const r = await api('/api/fav', { id: Number(fav.dataset.fav) });
    if (!r.ok) return toast(r.error || 'Не удалось сохранить', 'error');
    document.querySelectorAll<HTMLElement>(`[data-fav="${fav.dataset.fav}"]`).forEach((b) => {
      b.classList.toggle('is-on', r.on);
      b.setAttribute('aria-label', r.on ? 'Убрать из избранного' : 'В избранное');
      b.setAttribute('aria-pressed', String(r.on));
      const ic = b.querySelector('.ic');
      if (ic) {
        ic.classList.toggle('ic-heart', !r.on);
        ic.classList.toggle('ic-heart-fill', r.on);
      }
    });
    if (fav.dataset.favRemove !== undefined && !r.on) swap('[data-swap="favs"]');
    return;
  }

  if (t.closest('[data-cookie-ok]')) {
    document.cookie = 'cookie_ok=1; path=/; max-age=31536000; samesite=lax';
    // Дублируем на сервере: в статичной версии (service worker) cookie браузера серверу не видны
    fetch('/api/consent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {});
    document.querySelector('[data-cookie]')?.remove();
    document.querySelector('.page')?.classList.remove('cookie-open');
    return;
  }

  if (t.closest('[data-menu-open]')) return openModal(document.querySelector('[data-menu]'));
  if (t.closest('[data-menu-close]')) return closeModal(t.closest('.modal'));
  if (t.closest('[data-modal-close]')) return closeModal(t.closest('.modal'));

  const copy = t.closest<HTMLElement>('[data-copy]');
  if (copy) {
    e.stopPropagation();
    await navigator.clipboard?.writeText(copy.dataset.copy || '').catch(() => {});
    toast('Скопировано');
    return;
  }

  const back = t.closest<HTMLAnchorElement>('[data-back]');
  if (back && history.length > 1 && document.referrer.startsWith(location.origin)) {
    e.preventDefault();
    history.back();
  }
});

// ── Модальные окна ───────────────────────────────────────
let lastFocus: Element | null = null;
export function openModal(el: Element | null) {
  if (!el) return;
  lastFocus = document.activeElement;
  el.classList.add('open');
  document.body.classList.add('no-scroll');
  const f = el.querySelector<HTMLElement>('input:not([type=hidden]), button:not([data-modal-close]):not([data-menu-close]), a');
  setTimeout(() => f?.focus(), 30);
}
export function closeModal(el: Element | null) {
  if (!el) return;
  el.classList.remove('open');
  if (!document.querySelector('.modal.open')) document.body.classList.remove('no-scroll');
  (lastFocus as HTMLElement | null)?.focus?.();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach((m) => closeModal(m));
});

// ── Селекты из макета на нативном <select> ───────────────
function syncSelect(sel: HTMLSelectElement) {
  const span = sel.parentElement?.querySelector(':scope > span');
  if (span) span.textContent = (sel.dataset.prefix || '') + (sel.selectedOptions[0]?.textContent || '');
}
document.addEventListener('change', (e) => {
  const sel = e.target as HTMLSelectElement;
  if (sel.matches?.('.select select')) {
    syncSelect(sel);
    if (sel.dataset.nav !== undefined) {
      const url = new URL(location.href);
      if (sel.value) url.searchParams.set(sel.name, sel.value);
      else url.searchParams.delete(sel.name);
      url.searchParams.delete('page');
      location.href = url.toString();
    }
  }
  // Опции-радио: подсветка для браузеров без :has()
  const radio = e.target as HTMLInputElement;
  if (radio.type === 'radio' && radio.closest('.pl-option')) {
    document.querySelectorAll<HTMLInputElement>(`input[name="${radio.name}"]`).forEach((r) => r.closest('.pl-option')?.classList.toggle('is-selected', r.checked));
  }
  if (radio.type === 'checkbox' && radio.closest('.pl-check')) {
    radio.closest('.pl-check')!.classList.toggle('is-checked', radio.checked);
    radio.closest('.pl-check')!.classList.remove('is-error');
    const err = radio.closest('.pl-check')!.parentElement?.querySelector<HTMLElement>(':scope > .pl-field__error');
    if (err && radio.checked) err.hidden = true;
  }
});

// Маска телефона «+7 (___) ___-__-__»
export function maskPhone(input: HTMLInputElement) {
  if (input.dataset.masked) return;
  input.dataset.masked = '1';
  const fmt = () => {
    let d = input.value.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (d && !d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    let out = '';
    if (d.length) out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ') ' + d.slice(4, 7);
    if (d.length >= 7) out += '-' + d.slice(7, 9);
    if (d.length >= 9) out += '-' + d.slice(9, 11);
    input.value = out;
  };
  input.addEventListener('input', fmt);
  input.addEventListener('focus', () => {
    if (!input.value) input.value = '+7 (';
  });
  input.addEventListener('blur', () => {
    if (input.value.replace(/\D/g, '').length <= 1) input.value = '';
  });
  fmt();
}
document.querySelectorAll<HTMLInputElement>('input[data-phone]').forEach(maskPhone);
document.addEventListener('swapped', () => document.querySelectorAll<HTMLInputElement>('input[data-phone]').forEach(maskPhone));
