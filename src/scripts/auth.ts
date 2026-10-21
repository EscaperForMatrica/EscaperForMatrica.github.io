// Вход и регистрация по коду из письма: форма → отправка кода на почту → ввод 4 цифр → редирект.
import { api } from './app';

const form = document.querySelector<HTMLFormElement>('[data-auth-form]');
const step = document.querySelector<HTMLElement>('[data-otp-step]');

if (form && step) {
  const purpose = form.dataset.purpose || 'login';
  const next = form.dataset.next || '';
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const inputs = Array.from(step.querySelectorAll<HTMLInputElement>('[data-otp]'));
  const err = step.querySelector<HTMLElement>('[data-otp-error]')!;
  const otpBox = step.querySelector<HTMLElement>('.otp')!;
  const go = step.querySelector<HTMLButtonElement>('[data-otp-submit]')!;
  const timer = step.querySelector<HTMLElement>('[data-otp-timer]')!;
  const left = step.querySelector<HTMLElement>('[data-otp-left]')!;
  const resend = step.querySelector<HTMLButtonElement>('[data-otp-resend]')!;
  let email = '';
  let tick: number | undefined;

  const fieldErr = (name: string, msg: string | null) => {
    const el = form.querySelector<HTMLElement>(`[data-err="${name}"]`);
    const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (el) {
      el.hidden = !msg;
      const span = el.querySelector('span');
      if (span && msg) span.innerHTML = msg;
    }
    if (input?.classList.contains('pl-input')) input.classList.toggle('is-error', Boolean(msg));
    if (input?.type === 'checkbox') input.closest('.pl-check')?.classList.toggle('is-error', Boolean(msg));
  };

  // Кнопка активна, когда заполнены поля и отмечены обязательные согласия (как в макете)
  const ready = () => {
    const req = Array.from(form.querySelectorAll<HTMLInputElement>('[data-req]'));
    const ok = req.every((i) => (i.type === 'checkbox' ? i.checked : i.name === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.value.trim()) : i.value.trim().length > 1));
    submit.classList.toggle('is-disabled', !ok);
    const hint = form.querySelector<HTMLElement>('[data-ready-hint]');
    if (hint) hint.hidden = ok;
    return ok;
  };
  form.addEventListener('input', (e) => {
    const n = (e.target as HTMLInputElement).name;
    if (n) fieldErr(n, null);
    ready();
  });
  form.addEventListener('change', ready);
  ready();

  const startTimer = (sec: number) => {
    clearInterval(tick);
    let s = sec;
    timer.hidden = false;
    resend.hidden = true;
    const draw = () => (left.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    draw();
    tick = window.setInterval(() => {
      s -= 1;
      draw();
      if (s <= 0) {
        clearInterval(tick);
        timer.hidden = true;
        resend.hidden = false;
      }
    }, 1000);
  };

  const showDev = (code?: string) => {
    const dev = step.querySelector<HTMLElement>('[data-otp-dev]')!;
    dev.hidden = !code;
    if (code) step.querySelector('[data-otp-dev-code]')!.textContent = code;
  };

  const send = async () => {
    const data = Object.fromEntries(new FormData(form).entries());
    return api('/api/auth/request-code', { ...data, purpose });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!ready()) {
      form.querySelectorAll<HTMLInputElement>('[data-req]').forEach((i) => {
        const empty = i.type === 'checkbox' ? !i.checked : i.value.trim().length < 2;
        const badEmail = i.name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.value.trim());
        if (empty || badEmail) fieldErr(i.name, i.type === 'checkbox' ? (i.name === 'pd' ? 'Без согласия мы не сможем создать кабинет' : 'Нужно принять условия') : i.name === 'email' ? 'Проверьте адрес почты' : 'Заполните поле');
      });
      return;
    }
    submit.classList.add('is-loading');
    const r = await send();
    submit.classList.remove('is-loading');
    if (!r.ok) {
      if (r.wait && !r.field) return openStep(r.wait);
      let msg = r.error;
      if (r.register) msg += ` <a class="link" href="/register?email=${encodeURIComponent(String(new FormData(form).get('email')))}">Регистрация</a>`;
      if (r.login) msg += ` <a class="link" href="/login">Войти</a>`;
      fieldErr(r.field || 'email', msg);
      return;
    }
    showDev(r.devCode);
    openStep(r.wait || 60);
  });

  const openStep = (wait: number) => {
    email = String(new FormData(form).get('email') || '').trim().toLowerCase();
    step.querySelector('[data-otp-email]')!.textContent = email;
    form.closest('[data-form-card]')!.setAttribute('hidden', '');
    document.querySelectorAll<HTMLElement>('[data-hide-on-code]').forEach((el) => (el.hidden = true));
    step.hidden = false;
    inputs.forEach((i) => (i.value = ''));
    err.hidden = true;
    otpBox.classList.remove('is-error');
    inputs[0].focus();
    startTimer(wait);
    window.scrollTo({ top: 0 });
  };

  step.querySelector('[data-otp-back]')!.addEventListener('click', () => {
    step.hidden = true;
    form.closest('[data-form-card]')!.removeAttribute('hidden');
    document.querySelectorAll<HTMLElement>('[data-hide-on-code]').forEach((el) => (el.hidden = false));
    clearInterval(tick);
  });

  resend.addEventListener('click', async () => {
    const r = await send();
    if (r.ok) {
      showDev(r.devCode);
      startTimer(r.wait || 60);
    } else if (r.wait) startTimer(r.wait);
    else {
      err.hidden = false;
      err.querySelector('span')!.textContent = r.error;
    }
  });

  const code = () => inputs.map((i) => i.value).join('');
  const verify = async () => {
    if (code().length !== 4) return;
    go.classList.add('is-loading');
    const r = await api('/api/auth/verify', { email, code: code(), next });
    if (r.ok) {
      location.href = r.redirect || '/account';
      return;
    }
    go.classList.remove('is-loading');
    err.hidden = false;
    err.querySelector('span')!.textContent = r.error;
    otpBox.classList.add('is-error');
    if (r.left === 0) {
      inputs.forEach((i) => (i.disabled = true));
      clearInterval(tick);
      timer.hidden = true;
      resend.hidden = false;
    } else {
      inputs.forEach((i) => (i.value = ''));
      inputs[0].focus();
    }
    go.classList.add('is-disabled');
  };
  go.addEventListener('click', verify);

  inputs.forEach((input, idx) => {
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '');
      if (digits.length > 1) {
        // Вставка или автозаполнение кода целиком
        digits.slice(0, 4).split('').forEach((d, k) => inputs[k] && (inputs[k].value = d));
        inputs[Math.min(3, digits.length - 1)].focus();
      } else {
        input.value = digits;
        if (digits && inputs[idx + 1]) inputs[idx + 1].focus();
      }
      err.hidden = true;
      otpBox.classList.remove('is-error');
      go.classList.toggle('is-disabled', code().length !== 4);
      if (code().length === 4) verify();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && inputs[idx - 1]) inputs[idx - 1].focus();
      if (e.key === 'ArrowLeft' && inputs[idx - 1]) inputs[idx - 1].focus();
      if (e.key === 'ArrowRight' && inputs[idx + 1]) inputs[idx + 1].focus();
    });
    input.addEventListener('focus', () => input.select());
  });
  inputs.forEach((i) => (i.disabled = false));
}
