import type { Db } from './db';
import { config, isProd } from './config';

// Демо-наполнение: ассортимент и цены — из макетов. Всё редактируется в админке.

const USAGE_NOTE = 'Используйте перчатки. Храните в недоступном для детей месте.';
const MARK = ['Маркировка', '«Честный знак»'];

interface P {
  slug: string;
  cat: string;
  name: string;
  variant: string;
  subtitle?: string;
  sku?: string;
  washes?: number;
  price: number | null;
  old?: number | null;
  stock: number;
  ws?: number | null;
  box: number;
  img: string;
  popular?: boolean;
  visible?: boolean;
  sales: number;
  desc: string;
  usage: string[];
  comp: string;
  specs: string[][];
  related?: string[];
}

const LAUNDRY_USAGE = [
  'Отмерьте гель колпачком: 30 мл на 4–5 кг белья, при сильных загрязнениях — 45 мл.',
  'Налейте в отсек для основной стирки или прямо в барабан.',
  'Стирайте при температуре от 30 до 60 °C.',
];
const SPRAY_USAGE = [
  'Распылите средство на поверхность с расстояния 20–30 см.',
  'Оставьте на 2–3 минуты, сильный налёт — на 5 минут.',
  'Протрите влажной губкой и смойте водой.',
];
const DISH_USAGE = [
  'Нанесите несколько капель на влажную губку.',
  'Вспеньте и вымойте посуду.',
  'Тщательно ополосните посуду водой.',
];
const SOAP_USAGE = [
  'Нанесите небольшое количество на влажные руки.',
  'Вспеньте и распределите.',
  'Смойте тёплой водой.',
];
const HAIR_USAGE = [
  'Нанесите на влажные волосы.',
  'Помассируйте 1–2 минуты.',
  'Тщательно смойте водой.',
];
const GEL_COMP = '5–15% анионные ПАВ, менее 5% неионогенные ПАВ, энзимы, консервант, отдушка.';
const CLEAN_COMP = 'Вода, менее 5% неионогенные ПАВ, органические кислоты, загуститель, отдушка.';

const PRODUCTS: P[] = [
  // ── Для стирки ──
  {
    slug: 'gel-dlya-stirki-cvetnogo', cat: 'laundry', name: 'Гель для стирки цветного', variant: '5 литров', washes: 165,
    subtitle: '5 литров · 165 стирок', price: 899, old: 1024, stock: 146, ws: 720, box: 4, img: 'ph:canister:accent', popular: true, sales: 980,
    desc: 'Концентрированный гель бережно отстирывает загрязнения и сохраняет яркость цвета. Не оставляет разводов, легко выполаскивается и подходит для всех типов стиральных машин. Одной канистры хватает на 165 стирок.',
    usage: LAUNDRY_USAGE, comp: GEL_COMP,
    specs: [['Объём', '5 л'], ['Количество стирок', '165'], ['Габариты, Д×Ш×В', '190 × 125 × 300 мм'], ['Вес', '5,3 кг'], ['Подходит для', 'цветных тканей, ручной и машинной стирки']],
  },
  {
    slug: 'gel-dlya-stirki-chernogo', cat: 'laundry', name: 'Гель для стирки чёрного', variant: '5 литров', washes: 165,
    subtitle: '5 литров · 165 стирок', price: 899, old: 1024, stock: 98, ws: 720, box: 4, img: 'ph:canister:navy', popular: true, sales: 870,
    desc: 'Гель для тёмных и чёрных вещей: сохраняет глубину цвета, не оставляет белёсых разводов и защищает ткань от выцветания. Концентрированная формула — 165 стирок из одной канистры.',
    usage: LAUNDRY_USAGE, comp: GEL_COMP,
    specs: [['Объём', '5 л'], ['Количество стирок', '165'], ['Габариты, Д×Ш×В', '190 × 125 × 300 мм'], ['Вес', '5,3 кг'], ['Подходит для', 'чёрных и тёмных тканей']],
  },
  {
    slug: 'gel-dlya-stirki-belogo', cat: 'laundry', name: 'Гель для стирки белого', variant: '5 литров', washes: 165,
    subtitle: '5 литров · 165 стирок', price: 899, old: 1001, stock: 4, ws: 720, box: 4, img: 'ph:canister:gray', popular: true, sales: 760,
    desc: 'Возвращает белизну без хлора: удаляет серость и желтизну, освежает бельё и легко выполаскивается. Подходит для хлопка, льна и синтетики.',
    usage: LAUNDRY_USAGE, comp: GEL_COMP,
    specs: [['Объём', '5 л'], ['Количество стирок', '165'], ['Габариты, Д×Ш×В', '190 × 125 × 300 мм'], ['Вес', '5,3 кг'], ['Подходит для', 'белых тканей']],
  },
  {
    slug: 'belizna-gel-5l', cat: 'laundry', name: 'Белизна-гель', variant: '5 литров',
    price: 771, old: 1484, stock: 60, ws: 620, box: 4, img: 'ph:canister:accent', popular: true, sales: 640,
    desc: 'Отбеливает и дезинфицирует: подходит для белья, сантехники и кафеля. Густая гелевая формула экономно расходуется и не разбрызгивается.',
    usage: ['Для отбеливания добавьте 50 мл на 5 л воды.', 'Замочите бельё на 15–30 минут.', 'Постирайте как обычно и тщательно прополощите.'], comp: 'Гипохлорит натрия 5–15%, менее 5% неионогенные ПАВ, загуститель.',
    specs: [['Объём', '5 л'], ['Габариты, Д×Ш×В', '190 × 125 × 300 мм'], ['Вес', '5,6 кг']],
  },
  {
    slug: 'belizna-gel-1-5l', cat: 'laundry', name: 'Белизна-гель', variant: '1,5 литра',
    price: 299, stock: 120, ws: 240, box: 8, img: 'ph:bottle:accent', sales: 310,
    desc: 'Отбеливает и дезинфицирует: подходит для белья, сантехники и кафеля. Удобный флакон 1,5 литра.',
    usage: ['Для отбеливания добавьте 50 мл на 5 л воды.', 'Замочите бельё на 15–30 минут.', 'Постирайте как обычно и тщательно прополощите.'], comp: 'Гипохлорит натрия 5–15%, менее 5% неионогенные ПАВ, загуститель.',
    specs: [['Объём', '1,5 л'], ['Вес', '1,7 кг']],
  },
  {
    slug: 'belizna-gel-1l', cat: 'laundry', name: 'Белизна-гель', variant: '1 литр',
    price: 229, stock: 140, ws: 185, box: 12, img: 'ph:bottle:gray', sales: 280,
    desc: 'Отбеливает и дезинфицирует: подходит для белья, сантехники и кафеля. Компактный флакон 1 литр.',
    usage: ['Для отбеливания добавьте 50 мл на 5 л воды.', 'Замочите бельё на 15–30 минут.', 'Постирайте как обычно и тщательно прополощите.'], comp: 'Гипохлорит натрия 5–15%, менее 5% неионогенные ПАВ, загуститель.',
    specs: [['Объём', '1 л'], ['Вес', '1,15 кг']],
  },
  {
    slug: 'sprej-ot-pyaten', cat: 'laundry', name: 'Спрей от пятен', variant: '600 мл', sku: '4129324190',
    price: 299, old: 364, stock: 87, ws: 240, box: 12, img: 'ph:spray:warm', sales: 420,
    desc: 'Пятновыводитель перед стиркой: справляется с жиром, травой, кофе и косметикой. Не повреждает цветные ткани.',
    usage: ['Распылите на пятно до полного смачивания.', 'Оставьте на 5–10 минут, не допуская высыхания.', 'Постирайте как обычно.'], comp: CLEAN_COMP,
    specs: [['Объём', '600 мл'], ['Габариты, Д×Ш×В', '90 × 80 × 290 мм'], ['Вес', '650 г']],
  },
  // ── Для уборки ──
  {
    slug: 'sredstvo-dlya-vannyh', cat: 'cleaning', name: 'Средство для ванных', variant: '600 мл', subtitle: '600 мл · без едких запахов', sku: '4129323350',
    price: 249, old: 369, stock: 312, ws: 199, box: 12, img: 'ph:spray:navy', popular: true, sales: 720,
    desc: 'Сверкающая сантехника без долгих усилий и жёсткого трения. Универсальный очиститель эффективно убирает мыльный и известковый налёт, бережно относясь даже к деликатным покрытиям, таким как акриловые ванны. Отсутствие едких запахов делает уборку по-настоящему комфортной — в вашей ванной останется только идеальная чистота и приятный аромат.',
    usage: SPRAY_USAGE, comp: CLEAN_COMP,
    specs: [['Объём', '600 мл'], ['Габариты, Д×Ш×В', '90 × 80 × 290 мм'], ['Вес', '650 г'], ['Артикул', '4129323350'], ['Подходит для', 'деликатных покрытий, в том числе акриловых ванн'], MARK],
    related: ['antizhir-dlya-kuhni', 'wc-gel', 'sredstvo-dlya-stekol', 'sredstvo-ot-zasorov'],
  },
  {
    slug: 'wc-gel', cat: 'cleaning', name: 'WC-гель для унитазов и сантехники', variant: '1 литр',
    price: 269, stock: 150, ws: 215, box: 12, img: 'ph:bottle:navy', sales: 390,
    desc: 'Густой гель удаляет известковый налёт и ржавчину под ободком, дезинфицирует и освежает. Изогнутый носик помогает нанести средство в труднодоступных местах.',
    usage: ['Нанесите гель под ободок унитаза.', 'Оставьте на 10–15 минут.', 'Почистите ёршиком и смойте водой.'], comp: CLEAN_COMP,
    specs: [['Объём', '1 л'], ['Вес', '1,1 кг']],
  },
  {
    slug: 'sredstvo-dlya-stekol', cat: 'cleaning', name: 'Средство для стёкол', variant: '600 мл',
    price: 223, old: 346, stock: 180, ws: 179, box: 12, img: 'ph:spray:accent', sales: 350,
    desc: 'Чистые стёкла и зеркала без разводов. Быстро испаряется, не оставляет следов и ворсинок.',
    usage: ['Распылите на поверхность с расстояния 20–30 см.', 'Протрите сухой салфеткой из микрофибры.', 'При сильных загрязнениях повторите.'], comp: 'Вода, изопропиловый спирт 5–15%, менее 5% неионогенные ПАВ, отдушка.',
    specs: [['Объём', '600 мл'], ['Габариты, Д×Ш×В', '90 × 80 × 290 мм'], ['Вес', '640 г']],
  },
  {
    slug: 'sredstvo-ot-zasorov', cat: 'cleaning', name: 'Средство от засоров', variant: '1 литр',
    price: 285, old: 616, stock: 95, ws: 228, box: 12, img: 'ph:bottle:warm', sales: 300,
    desc: 'Растворяет жир, волосы и органические отложения в трубах. Безопасно для пластиковых и металлических труб.',
    usage: ['Залейте в слив 250 мл средства.', 'Оставьте на 30–60 минут.', 'Промойте горячей водой.'], comp: 'Гидроксид натрия 5–15%, менее 5% неионогенные ПАВ.',
    specs: [['Объём', '1 л'], ['Вес', '1,2 кг']],
  },
  {
    slug: 'sredstvo-dlya-polov', cat: 'cleaning', name: 'Средство для мытья полов', variant: '1 литр',
    price: 239, old: 329, stock: 110, ws: 191, box: 12, img: 'ph:bottle:accent', sales: 260,
    desc: 'Для ламината, линолеума, плитки и камня. Не оставляет разводов и наполняет дом свежим ароматом.',
    usage: ['Разведите 30 мл средства в 5 л воды.', 'Вымойте пол.', 'Смывать не нужно.'], comp: CLEAN_COMP,
    specs: [['Объём', '1 л'], ['Вес', '1,05 кг']],
  },
  {
    slug: 'universalnoe-sredstvo', cat: 'cleaning', name: 'Универсальное чистящее средство', variant: '600 мл',
    price: 219, old: 299, stock: 130, ws: 175, box: 12, img: 'ph:spray:gray', sales: 240,
    desc: 'Одно средство для кухни, ванной и мебели: удаляет жир, пыль и следы рук с любых моющихся поверхностей.',
    usage: SPRAY_USAGE, comp: CLEAN_COMP,
    specs: [['Объём', '600 мл'], ['Габариты, Д×Ш×В', '90 × 80 × 290 мм'], ['Вес', '640 г']],
  },
  {
    slug: 'sredstvo-protiv-pleseni', cat: 'cleaning', name: 'Средство против плесени', variant: '600 мл',
    price: 259, old: 349, stock: 75, ws: 207, box: 12, img: 'ph:spray:warm', sales: 180,
    desc: 'Удаляет плесень и грибок со швов плитки, герметика и стен. Предотвращает повторное появление.',
    usage: SPRAY_USAGE, comp: 'Гипохлорит натрия менее 5%, менее 5% неионогенные ПАВ.',
    specs: [['Объём', '600 мл'], ['Габариты, Д×Ш×В', '90 × 80 × 290 мм'], ['Вес', '650 г']],
  },
  {
    slug: 'sredstvo-ot-nakipi', cat: 'cleaning', name: 'Средство от накипи и ржавчины', variant: '600 мл',
    price: 239, stock: 90, ws: 191, box: 12, img: 'ph:bottle:gray', sales: 150,
    desc: 'Удаляет известковый налёт, накипь и ржавчину со смесителей, раковин и душевых кабин.',
    usage: SPRAY_USAGE, comp: CLEAN_COMP,
    specs: [['Объём', '600 мл'], ['Вес', '660 г']],
  },
  // ── Для кухни ──
  {
    slug: 'gel-dlya-posudy-yabloko', cat: 'kitchen', name: 'Гель для мытья посуды', variant: 'Зелёное яблоко · 1 литр',
    price: 249, old: 387, stock: 204, ws: 199, box: 12, img: 'ph:bottle:accent', popular: true, sales: 690,
    desc: 'Густой гель с ароматом зелёного яблока легко справляется с жиром даже в холодной воде. Бережно относится к коже рук.',
    usage: DISH_USAGE, comp: '5–15% анионные ПАВ, менее 5% амфотерные ПАВ, консервант, отдушка.',
    specs: [['Объём', '1 л'], ['Аромат', 'зелёное яблоко'], ['Вес', '1,05 кг']],
  },
  {
    slug: 'gel-dlya-posudy-vishnya', cat: 'kitchen', name: 'Гель для мытья посуды', variant: 'Вишня · 1 литр',
    price: 279, old: 387, stock: 160, ws: 223, box: 12, img: 'ph:bottle:warm', sales: 410,
    desc: 'Густой гель с ароматом вишни легко справляется с жиром даже в холодной воде. Бережно относится к коже рук.',
    usage: DISH_USAGE, comp: '5–15% анионные ПАВ, менее 5% амфотерные ПАВ, консервант, отдушка.',
    specs: [['Объём', '1 л'], ['Аромат', 'вишня'], ['Вес', '1,05 кг']],
  },
  {
    slug: 'antizhir-dlya-kuhni', cat: 'kitchen', name: 'Антижир для кухни', variant: '600 мл',
    price: 257, old: 372, stock: 175, ws: 205, box: 12, img: 'ph:spray:accent', popular: true, sales: 650,
    desc: 'Растворяет застарелый жир и нагар на плитах, вытяжках и духовках. Работает без усилий за 2–3 минуты.',
    usage: SPRAY_USAGE, comp: CLEAN_COMP,
    specs: [['Объём', '600 мл'], ['Габариты, Д×Ш×В', '90 × 80 × 290 мм'], ['Вес', '650 г']],
  },
  // ── Для гигиены ──
  {
    slug: 'zhidkoe-mylo-5l', cat: 'hygiene', name: 'Жидкое мыло', variant: '5 литров',
    price: 592, old: 714, stock: 85, ws: 475, box: 4, img: 'ph:pump:accent', popular: true, sales: 520,
    desc: 'Нежное жидкое мыло для рук с глицерином: мягко очищает и не сушит кожу. Канистра 5 литров — для дома и офиса.',
    usage: SOAP_USAGE, comp: 'Вода, лауретсульфат натрия, кокамидопропилбетаин, глицерин, отдушка.',
    specs: [['Объём', '5 л'], ['Вес', '5,2 кг']],
  },
  {
    slug: 'hozyajstvennoe-mylo-zhidkoe', cat: 'hygiene', name: 'Хозяйственное мыло жидкое', variant: '5 литров',
    price: 649, stock: 0, ws: 520, box: 4, img: 'ph:canister:gray', sales: 200,
    desc: 'Классическое хозяйственное мыло в жидком виде: для стирки, уборки и замачивания.',
    usage: SOAP_USAGE, comp: 'Калиевые соли жирных кислот, вода.',
    specs: [['Объём', '5 л'], ['Вес', '5,2 кг']],
  },
  {
    slug: 'zhidkoe-mylo-500', cat: 'hygiene', name: 'Жидкое мыло с дозатором', variant: '500 мл',
    price: 189, stock: 140, ws: 150, box: 20, img: 'ph:pump:warm', sales: 210,
    desc: 'Жидкое мыло для рук во флаконе с дозатором. Мягко очищает и не сушит кожу.',
    usage: SOAP_USAGE, comp: 'Вода, лауретсульфат натрия, кокамидопропилбетаин, глицерин, отдушка.',
    specs: [['Объём', '500 мл'], ['Вес', '540 г']],
  },
  // ── Уход за волосами ──
  {
    slug: 'shampun-fleur-narcotique', cat: 'hair', name: 'Шампунь Fleur Narcotique', variant: '500 мл',
    price: 349, old: 449, stock: 70, ws: 279, box: 12, img: 'ph:pump:navy', sales: 230,
    desc: 'Парфюмированный шампунь с цветочно-фруктовым ароматом. Мягко очищает, придаёт волосам блеск и объём.',
    usage: HAIR_USAGE, comp: 'Вода, лауретсульфат натрия, кокамидопропилбетаин, пантенол, отдушка.',
    specs: [['Объём', '500 мл'], ['Вес', '540 г']],
  },
  {
    slug: 'kondicioner-fleur-narcotique', cat: 'hair', name: 'Кондиционер для волос', variant: 'Fleur Narcotique',
    price: null, stock: 0, ws: null, box: 12, img: 'ph:pump:warm', visible: false, sales: 0,
    desc: 'Парфюмированный кондиционер: облегчает расчёсывание, смягчает и защищает волосы.',
    usage: HAIR_USAGE, comp: 'Вода, цетеариловый спирт, бехентримониум хлорид, пантенол, отдушка.',
    specs: [['Объём', '500 мл']],
  },
  {
    slug: 'shampun-1l', cat: 'hair', name: 'Шампунь для всех типов волос', variant: '1 литр',
    price: 399, stock: 65, ws: 319, box: 12, img: 'ph:bottle:navy', sales: 190,
    desc: 'Мягкий шампунь для ежедневного применения. Подходит для всей семьи.',
    usage: HAIR_USAGE, comp: 'Вода, лауретсульфат натрия, кокамидопропилбетаин, пантенол, отдушка.',
    specs: [['Объём', '1 л'], ['Вес', '1,05 кг']],
  },
  {
    slug: 'balzam-opolaskivatel', cat: 'hair', name: 'Бальзам-ополаскиватель', variant: '1 литр',
    price: 389, stock: 55, ws: 311, box: 12, img: 'ph:pump:gray', sales: 170,
    desc: 'Бальзам облегчает расчёсывание, делает волосы мягкими и блестящими.',
    usage: HAIR_USAGE, comp: 'Вода, цетеариловый спирт, бехентримониум хлорид, пантенол, отдушка.',
    specs: [['Объём', '1 л'], ['Вес', '1,05 кг']],
  },
];

const CATEGORIES: Array<[string, string]> = [
  ['laundry', 'Для стирки'],
  ['cleaning', 'Для уборки'],
  ['kitchen', 'Для кухни'],
  ['hygiene', 'Для гигиены'],
  ['hair', 'Уход за волосами'],
];

export function seed(db: Db) {
  db.tx(() => {
    CATEGORIES.forEach(([slug, name], i) => db.run('insert into categories (slug, name, sort) values (?, ?, ?)', slug, name, i));
    const catId = (slug: string) => db.value<number>('select id from categories where slug = ?', slug)!;

    PRODUCTS.forEach((p, i) => {
      const specs = p.specs.some(([k]) => k === 'Маркировка') ? p.specs : [...p.specs, ...(p.sku ? [['Артикул', p.sku]] : []), MARK];
      db.run(
        `insert into products (slug, name, variant, subtitle, sku, category_id, washes, description, usage, usage_note, composition, specs, images,
          price, old_price, stock, wholesale_price, box_qty, visible, popular, sort, sales)
         values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        p.slug, p.name, p.variant, p.subtitle || '', p.sku || '', catId(p.cat), p.washes ?? null, p.desc, p.usage.join('\n'), USAGE_NOTE, p.comp,
        JSON.stringify(specs), JSON.stringify([p.img]), p.price, p.old ?? null, p.stock, p.ws ?? null, p.box,
        p.visible === false ? 0 : 1, p.popular ? 1 : 0, i, p.sales,
      );
    });
    for (const p of PRODUCTS) {
      if (!p.related) continue;
      const ids = p.related.map((s) => db.value<number>('select id from products where slug = ?', s)).filter(Boolean);
      db.run('update products set related = ? where slug = ?', JSON.stringify(ids), p.slug);
    }

    // Промокоды из макета админки
    const promo = db.raw.prepare('insert into promo_codes (code, kind, value, min_total, starts_at, ends_at, usage_limit, once_per_customer, used) values (?,?,?,?,?,?,?,?,?)');
    promo.run('PALADA10', 'percent', 10, 0, null, '2026-12-31', null, 0, 214);
    promo.run('PERVYI300', 'fixed', 300, 1500, null, null, 1000, 1, 87);
    promo.run('OPT5', 'percent', 5, 10000, null, '2027-03-31', 50, 0, 12);
    promo.run('LETO20', 'percent', 20, 2000, '2026-06-01', '2026-08-31', 400, 0, 400);
    promo.run('SALE2024', 'percent', 15, 0, null, '2024-12-31', null, 0, 1032);

    // Администраторы — из ADMIN_PHONES; в разработке без настройки — демо-номер
    const admins = config.adminPhones.length ? config.adminPhones : isProd && !config.demo ? [] : ['79000000000'];
    for (const phone of admins) db.run(`insert into users (phone, name, role) values (?, 'Администратор', 'admin')`, phone);

    // Демо-покупатели и заказы — только в разработке (или SEED_DEMO=true): номера вымышленные,
    // но в боевой базе им не место
    if (isProd && !config.demo && process.env.SEED_DEMO !== 'true') return;
    const anna = Number(db.run(
      `insert into users (phone, name, email, newsletter, offer_accepted_at, pd_consent_at, created_at) values (?,?,?,1,datetime('now','-19 days'),datetime('now','-19 days'),datetime('now','-19 days'))`,
      '79001112233', 'Иванова Анна Сергеевна', 'anna.ivanova@mail.ru',
    ).lastInsertRowid);
    const company = Number(db.run(
      `insert into companies (inn, kpp, ogrn, name, address, status) values ('6164000000','616401001','1186100000000','ООО «Чистый дом»','г. Ростов-на-Дону, ул. Примерная, 1','ACTIVE')`,
    ).lastInsertRowid);
    const olga = Number(db.run(
      `insert into users (phone, name, email, role, company_id, position, offer_accepted_at, pd_consent_at) values (?,?,?,'b2b',?,?,datetime('now','-40 days'),datetime('now','-40 days'))`,
      '79002223344', 'Смирнова Ольга Петровна', 'zakupki@chistydom.ru', company, 'закупщик',
    ).lastInsertRowid);

    // Демо-заказы — чтобы кабинет и админка не были пустыми
    const pid = (slug: string) => db.get<any>('select * from products where slug = ?', slug)!;
    type Line = [slug: string, qty: number];
    const mk = (o: {
      id: number; user?: number; company?: number; kind?: string; status: string; name: string; phone: string; email: string;
      type: 'ozon' | 'wb'; address: string; hours?: string; delivery: number; lines: Line[]; promo?: [string, number]; method: string;
      daysAgo: number; track?: string; events: string[]; storageDays?: number; receivedDaysAgo?: number; wholesale?: boolean;
    }) => {
      const items = o.lines.map(([s, q]) => {
        const p = pid(s);
        const price = o.wholesale ? p.wholesale_price : p.price;
        return { p, q, price };
      });
      const itemsTotal = items.reduce((a, x) => a + x.price * x.q, 0);
      const oldTotal = items.reduce((a, x) => a + (x.p.old_price || x.price) * x.q, 0);
      const discount = o.promo ? o.promo[1] : 0;
      const created = `datetime('now','-${o.daysAgo} days','-${(o.id % 7) + 1} hours')`;
      db.run(
        `insert into orders (id, kind, status, user_id, company_id, name, phone, email, delivery_type, city, pvz_address, pvz_hours, delivery_cost, delivery_eta,
          items_total, old_total, discount, promo_code, total, payment_method, track, storage_until, paid_at, received_at, created_at, updated_at)
         values (?,?,?,?,?,?,?,?,?,?,?,?,?,'',?,?,?,?,?,?,?,${o.storageDays ? `date('now','+${o.storageDays} days')` : 'null'},
           ${o.status === 'pending' ? 'null' : created}, ${o.receivedDaysAgo ? `datetime('now','-${o.receivedDaysAgo} days')` : 'null'}, ${created}, ${created})`,
        o.id, o.kind || 'retail', o.status, o.user ?? null, o.company ?? null, o.name, o.phone, o.email, o.type, 'Ростов-на-Дону', o.address, o.hours || '',
        o.delivery, itemsTotal, oldTotal, discount, o.promo ? o.promo[0] : null, itemsTotal - discount + o.delivery, o.method, o.track || '',
      );
      for (const x of items) {
        db.run('insert into order_items (order_id, product_id, name, variant, image, price, old_price, qty, box_qty) values (?,?,?,?,?,?,?,?,?)',
          o.id, x.p.id, x.p.name, x.p.variant, JSON.parse(x.p.images)[0], x.price, o.wholesale ? x.p.price : x.p.old_price, x.q, o.wholesale ? x.p.box_qty : 1);
      }
      o.events.forEach((st, i) => db.run(`insert into order_events (order_id, status, at) values (?, ?, datetime('now','-${o.daysAgo} days','+${i * 20} hours'))`, o.id, st));
    };

    const ANNA = { user: anna, name: 'Иванова Анна Сергеевна', phone: '79001112233', email: 'anna.ivanova@mail.ru' };
    mk({ ...ANNA, id: 10398, status: 'received', type: 'ozon', address: 'ул. Большая Садовая, 47', delivery: 99, lines: [['gel-dlya-stirki-cvetnogo', 2]], method: 'card', daysAgo: 19, events: ['paid', 'assembling', 'shipping', 'pvz', 'received'], receivedDaysAgo: 14, track: 'OZN-47880214-0004' });
    mk({ ...ANNA, id: 10471, status: 'pvz', type: 'ozon', address: 'ул. Большая Садовая, 47', hours: 'Ежедневно 9:00–21:00', delivery: 132, lines: [['gel-dlya-stirki-cvetnogo', 1], ['gel-dlya-stirki-chernogo', 1], ['antizhir-dlya-kuhni', 1]], method: 'card', daysAgo: 5, track: 'OZN-48120937-0018', storageDays: 5, events: ['paid', 'assembling', 'shipping', 'pvz'] });
    mk({ ...ANNA, id: 10476, status: 'shipping', type: 'wb', address: 'г. Ростов-на-Дону, ул. Пушкинская, 140', delivery: 199, lines: [['gel-dlya-stirki-belogo', 1], ['shampun-1l', 1]], method: 'sbp', daysAgo: 3, track: 'WB 7712 0094 3381', events: ['paid', 'assembling', 'shipping'] });
    mk({ ...ANNA, id: 10479, status: 'assembling', type: 'ozon', address: 'пр. Ворошиловский, 12', delivery: 0, lines: [['belizna-gel-5l', 1]], method: 'card', daysAgo: 2, events: ['paid', 'assembling'] });
    mk({ ...ANNA, id: 10482, status: 'paid', type: 'ozon', address: 'ул. Большая Садовая, 47', hours: 'Ежедневно 9:00–21:00', delivery: 99, lines: [['gel-dlya-stirki-cvetnogo', 2], ['sredstvo-dlya-vannyh', 1], ['gel-dlya-posudy-yabloko', 3]], promo: ['PALADA10', 279], method: 'card', daysAgo: 1, events: ['paid'] });

    mk({ id: 10483, name: 'Петров Игорь Викторович', phone: '79285550123', email: 'i.petrov@yandex.ru', status: 'paid', type: 'wb', address: 'г. Ростов-на-Дону, ул. Пушкинская, 140', delivery: 199, lines: [['gel-dlya-stirki-cvetnogo', 2], ['sredstvo-dlya-vannyh', 1], ['gel-dlya-posudy-yabloko', 3]], promo: ['PALADA10', 279], method: 'sbp', daysAgo: 0, events: ['paid'] });
    mk({ id: 10480, name: 'Ахмедова Лейла Руслановна', phone: '79631200000', email: 'leyla.a@mail.ru', status: 'assembling', type: 'wb', address: 'г. Ростов-на-Дону, пр. Шолохова, 31', delivery: 199, lines: [['sredstvo-dlya-vannyh', 2], ['wc-gel', 1], ['sredstvo-dlya-stekol', 1], ['gel-dlya-posudy-vishnya', 1]], method: 'card', daysAgo: 2, events: ['paid', 'assembling'] });
    mk({ id: 10461, name: 'Сидоров Кирилл Андреевич', phone: '79054310000', email: 'k.sidorov@gmail.com', status: 'pvz', type: 'wb', address: 'г. Ростов-на-Дону, ул. Ленина, 88', delivery: 199, lines: [['gel-dlya-stirki-cvetnogo', 2], ['gel-dlya-stirki-chernogo', 1], ['zhidkoe-mylo-5l', 1]], method: 'card', daysAgo: 8, track: 'WB 7712 0091 0457', storageDays: 3, events: ['paid', 'assembling', 'shipping', 'pvz'] });
    mk({ id: 10440, name: 'Мамедов Тимур Шамилевич', phone: '79887020000', email: 't.mamedov@mail.ru', status: 'received', type: 'wb', address: 'г. Ростов-на-Дону, ул. Красноармейская, 5', delivery: 0, lines: [['gel-dlya-stirki-cvetnogo', 1]], method: 'sbp', daysAgo: 15, track: 'WB 7712 0087 2219', receivedDaysAgo: 9, events: ['paid', 'assembling', 'shipping', 'pvz', 'received'] });

    const OLGA = { user: olga, company, kind: 'b2b', wholesale: true, name: 'Смирнова Ольга Петровна', phone: '79002223344', email: 'zakupki@chistydom.ru' };
    mk({ ...OLGA, id: 10421, status: 'received', type: 'ozon', address: 'пр. Ворошиловский, 12', delivery: 390, lines: [['gel-dlya-stirki-cvetnogo', 12], ['zhidkoe-mylo-5l', 8], ['gel-dlya-posudy-yabloko', 24]], method: 'card', daysAgo: 23, track: 'OZN-47710533-0102', receivedDaysAgo: 17, events: ['paid', 'assembling', 'shipping', 'pvz', 'received'] });
    mk({ ...OLGA, id: 10455, status: 'shipping', type: 'wb', address: 'г. Ростов-на-Дону, ул. Пушкинская, 140', delivery: 450, lines: [['gel-dlya-stirki-cvetnogo', 20], ['gel-dlya-stirki-chernogo', 12], ['sredstvo-dlya-vannyh', 24]], method: 'invoice', daysAgo: 9, track: 'WB 7712 0089 5530', events: ['paid', 'assembling', 'shipping'] });
    db.run(`insert into documents (order_id, kind, number) values (10455, 'invoice', '10455'), (10455, 'upd', '10455'), (10421, 'upd', '10421'), (10421, 'receipt', '10421')`);
    // Новые заказы продолжат нумерацию с 10484 (rowid = max + 1).
  });
}
