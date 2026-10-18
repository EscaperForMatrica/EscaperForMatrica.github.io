// Иллюстрации-заглушки товаров из макетов (канистра, флакон, спрей, дозатор).
// В карточке товара хранится ссылка «ph:<форма>:<цвет>» или путь к загруженному фото «/uploads/…».

export const PH_COLORS: Record<string, string> = {
  accent: '#15aea9',
  navy: '#1f3a5f',
  gray: '#64748b',
  warm: '#ef7d68',
};

export const PH_SHAPES = ['canister', 'bottle', 'spray', 'pump'] as const;
export type PhShape = (typeof PH_SHAPES)[number];

const SHAPES: Record<PhShape, (c: string) => string> = {
  canister: (c) =>
    `<rect x="70" y="60" width="100" height="140" rx="14" fill="#fff"/><rect x="128" y="40" width="30" height="26" rx="6" fill="${c}"/><path d="M80 60h30v-12a8 8 0 0 0-8-8h-14a8 8 0 0 0-8 8z" fill="#fff"/><rect x="82" y="104" width="76" height="62" rx="6" fill="${c}" opacity=".16"/><rect x="92" y="118" width="40" height="6" rx="3" fill="${c}"/><rect x="92" y="132" width="56" height="4" rx="2" fill="${c}" opacity=".45"/><rect x="92" y="142" width="44" height="4" rx="2" fill="${c}" opacity=".45"/>`,
  bottle: (c) =>
    `<rect x="96" y="30" width="48" height="22" rx="5" fill="${c}"/><path d="M100 52h40v14c14 8 20 18 20 32v92a10 10 0 0 1-10 10H90a10 10 0 0 1-10-10V98c0-14 6-24 20-32z" fill="#fff"/><rect x="88" y="116" width="64" height="58" rx="6" fill="${c}" opacity=".16"/><rect x="98" y="130" width="36" height="6" rx="3" fill="${c}"/><rect x="98" y="144" width="44" height="4" rx="2" fill="${c}" opacity=".45"/>`,
  spray: (c) =>
    `<path d="M102 30h34l12 10v12h-16v12h-24V44z" fill="${c}"/><path d="M104 64h32v8c10 6 16 14 16 26v94a8 8 0 0 1-8 8H96a8 8 0 0 1-8-8V98c0-12 6-20 16-26z" fill="#fff"/><rect x="96" y="118" width="48" height="56" rx="6" fill="${c}" opacity=".16"/><rect x="104" y="132" width="28" height="6" rx="3" fill="${c}"/>`,
  pump: (c) =>
    `<path d="M108 34h36v8h-20v14h-16z" fill="${c}"/><rect x="104" y="56" width="32" height="14" rx="3" fill="${c}"/><rect x="72" y="70" width="96" height="130" rx="14" fill="#fff"/><rect x="84" y="108" width="72" height="62" rx="6" fill="${c}" opacity=".16"/><rect x="94" y="122" width="40" height="6" rx="3" fill="${c}"/>`,
};

const BGS = ['#eef3f5', '#e6f4f3', '#f1f5f7', '#eaf0f3'];

/** SVG заглушки. variant 1 — основной кадр, 2 — крупный план, 3 — две упаковки, 4 — сбоку. */
export function placeholderSvg(shape: string, color: string, variant = 1, bg?: string): string {
  const s = (SHAPES as any)[shape] ? (shape as PhShape) : 'bottle';
  const c = PH_COLORS[color] || PH_COLORS.accent;
  const v = Math.min(Math.max(variant | 0, 1), 4);
  const back = bg || BGS[v - 1];
  let body = SHAPES[s](c);
  if (v === 2) body = `<g transform="translate(120 128) scale(1.45) translate(-120 -128)">${body}</g>`;
  if (v === 3) body = `<g transform="translate(78 30) scale(.72) translate(-120 0)">${body}</g><g transform="translate(162 46) scale(.72) translate(-120 0)">${body}</g>`;
  if (v === 4) body = `<g transform="translate(18 0) rotate(-6 120 200)">${body}</g>`;
  const shadow = v === 2 ? '' : '<ellipse cx="120" cy="204" rx="62" ry="7" fill="#000" opacity=".05"/>';
  return `<svg viewBox="0 0 240 240" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Фото товара"><rect width="240" height="240" fill="${back}"/>${shadow}${body}</svg>`;
}

/** Ссылка на картинку для <img src>. */
export function imageUrl(ref: string | undefined | null, variant = 1): string {
  if (!ref) return '/img/ph/bottle-gray.svg';
  if (ref.startsWith('ph:')) {
    const [, shape, color, v] = ref.split(':');
    const vv = Number(v || variant) || 1;
    return `/img/ph/${shape}-${color}${vv > 1 ? '-' + vv : ''}.svg`;
  }
  return ref;
}

/** Галерея: если у товара одно фото-заглушка — показываем 4 ракурса, как в макете. */
export function galleryUrls(images: string[]): string[] {
  if (!images.length) return [imageUrl(null)];
  if (images.length === 1 && images[0].startsWith('ph:')) {
    return [1, 2, 3, 4].map((v) => imageUrl(images[0], v));
  }
  return images.map((i) => imageUrl(i));
}
