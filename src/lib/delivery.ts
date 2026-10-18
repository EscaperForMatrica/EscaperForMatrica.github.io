import { etaRange } from './format';

// Пункты выдачи Ozon. Сейчас — справочник в коде (демо-данные); для боевого запуска
// замените getPoints() на запрос к API Ozon Logistics / виджету выбора ПВЗ.

export interface Pvz {
  id: string;
  city: string;
  address: string;
  hours: string;
  price: number;
  days: [number, number];
  /** Позиция метки на схеме карты, % */
  x: number;
  y: number;
}

export const WB_PRICE = 199;
export const WB_DAYS: [number, number] = [3, 6];
export const OZON_MIN_PRICE = 99;

type Raw = [address: string, hours: string, price: number, d1: number, d2: number];

const EVERY_9_21 = 'Ежедневно 9:00–21:00';
const EVERY_10_22 = 'Ежедневно 10:00–22:00';
const WEEK_9_20 = 'Пн–Сб 9:00–20:00';
const EVERY_8_22 = 'Ежедневно 8:00–22:00';

const CITIES: Record<string, Raw[]> = {
  'Ростов-на-Дону': [
    ['ул. Большая Садовая, 47', EVERY_9_21, 99, 3, 5],
    ['пр. Ворошиловский, 12', EVERY_10_22, 99, 3, 5],
    ['ул. Пушкинская, 140', WEEK_9_20, 129, 4, 6],
    ['пр. Шолохова, 31', EVERY_9_21, 99, 3, 5],
    ['ул. Красноармейская, 5', EVERY_8_22, 129, 4, 6],
  ],
  'Москва': [
    ['ул. Тверская, 12', EVERY_8_22, 129, 3, 5],
    ['Ленинградский пр-т, 39', EVERY_10_22, 129, 3, 5],
    ['ул. Профсоюзная, 56', EVERY_9_21, 149, 4, 6],
    ['ул. Новослободская, 4', EVERY_9_21, 129, 3, 5],
    ['Варшавское ш., 87', WEEK_9_20, 149, 4, 6],
  ],
  'Санкт-Петербург': [
    ['Невский пр-т, 88', EVERY_9_21, 129, 4, 6],
    ['ул. Садовая, 32', EVERY_10_22, 129, 4, 6],
    ['Московский пр-т, 143', EVERY_8_22, 149, 5, 7],
    ['пр. Просвещения, 19', WEEK_9_20, 149, 5, 7],
  ],
  'Краснодар': [
    ['ул. Красная, 120', EVERY_9_21, 99, 3, 5],
    ['ул. Северная, 324', EVERY_10_22, 99, 3, 5],
    ['ул. Ставропольская, 207', WEEK_9_20, 129, 4, 6],
    ['ул. Тургенева, 33', EVERY_8_22, 99, 3, 5],
  ],
  'Ставрополь': [
    ['пр. Карла Маркса, 53', EVERY_9_21, 99, 3, 5],
    ['ул. Ленина, 251', EVERY_10_22, 129, 4, 6],
    ['ул. 50 лет ВЛКСМ, 16', WEEK_9_20, 99, 3, 5],
  ],
  'Пятигорск': [
    ['пр. Кирова, 21', EVERY_9_21, 99, 3, 5],
    ['ул. Ессентукская, 31', EVERY_10_22, 129, 4, 6],
    ['ул. Университетская, 9', WEEK_9_20, 99, 3, 5],
  ],
  'Махачкала': [
    ['пр. Имама Шамиля, 35', EVERY_9_21, 129, 4, 6],
    ['ул. Ярагского, 71', EVERY_10_22, 129, 4, 6],
    ['пр. Гамидова, 18', EVERY_8_22, 149, 5, 7],
  ],
  'Грозный': [
    ['пр. Путина, 10', EVERY_9_21, 129, 4, 6],
    ['ул. Лорсанова, 4', EVERY_10_22, 129, 4, 6],
    ['пр. Кадырова, 52', WEEK_9_20, 149, 5, 7],
  ],
  'Назрань': [
    ['ул. Московская, 23', EVERY_9_21, 129, 4, 6],
    ['пр. Базоркина, 70', WEEK_9_20, 129, 4, 6],
  ],
  'Владикавказ': [
    ['пр. Мира, 15', EVERY_9_21, 129, 4, 6],
    ['ул. Кирова, 44', EVERY_10_22, 129, 4, 6],
    ['ул. Владикавказская, 30', WEEK_9_20, 149, 5, 7],
  ],
  'Нальчик': [
    ['пр. Ленина, 38', EVERY_9_21, 129, 4, 6],
    ['ул. Кабардинская, 162', EVERY_10_22, 129, 4, 6],
  ],
  'Волгоград': [
    ['пр. Ленина, 59', EVERY_9_21, 129, 4, 6],
    ['ул. Рабоче-Крестьянская, 10', EVERY_10_22, 129, 4, 6],
    ['ул. Землячки, 110', WEEK_9_20, 149, 5, 7],
  ],
  'Воронеж': [
    ['пр. Революции, 33', EVERY_9_21, 129, 4, 6],
    ['Московский пр-т, 129', EVERY_10_22, 129, 4, 6],
  ],
  'Казань': [
    ['ул. Баумана, 44', EVERY_9_21, 149, 5, 7],
    ['пр. Ямашева, 46', EVERY_10_22, 149, 5, 7],
  ],
};

// Раскладка меток на схеме карты (повторяет макет).
const SPOTS: Array<[number, number]> = [
  [44, 46], [20, 30], [76, 56], [32, 10], [86, 26], [60, 18], [12, 66],
];

function slug(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

const ALL: Pvz[] = Object.entries(CITIES).flatMap(([city, list]) =>
  list.map(([address, hours, price, d1, d2], i) => ({
    id: `oz-${slug(city + address)}`,
    city,
    address,
    hours,
    price,
    days: [d1, d2] as [number, number],
    x: SPOTS[i % SPOTS.length][0],
    y: SPOTS[i % SPOTS.length][1],
  })),
);

export const cityNames = () => Object.keys(CITIES);

export function findCity(q: string): string | undefined {
  const n = q.trim().toLowerCase().replace(/^г\.?\s*/, '');
  return cityNames().find((c) => c.toLowerCase() === n) || cityNames().find((c) => c.toLowerCase().startsWith(n));
}

export function getPoints(city: string): Pvz[] {
  return ALL.filter((p) => p.city === city);
}

export function getPoint(id: string): Pvz | undefined {
  return ALL.find((p) => p.id === id);
}

export function pvzEta(p: Pvz) {
  return etaRange(p.days[0], p.days[1]);
}

/** Стоимость доставки. Для опта — по числу коробок (крупное отправление). */
export function deliveryCost(type: 'ozon' | 'wb', pvz: Pvz | undefined, boxes = 0): number {
  if (type === 'wb') return boxes ? Math.max(WB_PRICE, 150 + 30 * boxes) : WB_PRICE;
  const base = pvz?.price ?? OZON_MIN_PRICE;
  return boxes ? Math.max(base, 150 + 30 * boxes) : base;
}

export function deliveryEta(type: 'ozon' | 'wb', pvz: Pvz | undefined): string {
  if (type === 'wb') return etaRange(WB_DAYS[0], WB_DAYS[1]);
  return pvz ? pvzEta(pvz) : '';
}
