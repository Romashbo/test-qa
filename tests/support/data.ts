import { randomUUID } from 'node:crypto';

/**
 * Товары из исходного каталога (app/products.json), на которые опираются тесты.
 * Цены и остатки в проверках всегда берутся из API, здесь — только идентификаторы.
 * Для заказов используются товары с большим остатком, чтобы тесты были повторяемы
 * и на «живом» стенде.
 */
export const PRODUCTS = {
  ethiopia: 1, // Кофе Эфиопия Иргачефф — 890 ₽
  brazil: 2, // Кофе Бразилия Сантос — 2150 ₽
  decaf: 3, // Кофе Колумбия без кофеина — нет в наличии
  assam: 5, // Чай Ассам — «чёрный» в описании
  kettle: 11, // Чайник — остаток 3 шт. (проверка лимита остатка, не заказываем)
  filters: 9, // Фильтры V60 — 450 ₽, остаток 60
  chocolate: 13, // Шоколад — 320 ₽, остаток 48
  certificate: 16, // Сертификат — ровно 2000 ₽, остаток 100
} as const;

export const PROMO = {
  percent: 'SALE10', // −10 %
  fixed: 'WELCOME500', // −500 ₽ при сумме товаров от 2000 ₽
  fixedMin: 2000,
} as const;

export const DELIVERY = { price: 300, freeFrom: 3000 } as const;

export const CATEGORIES = {
  coffee: 'Кофе',
  tea: 'Чай',
  gear: 'Аксессуары',
  sweets: 'Сладости',
  gifts: 'Подарки',
} as const;

export const VALID_PHONE = '+7 900 123-45-67';

/** Уникальный пользователь на каждый тест — тесты независимы и параллелятся. */
export function newUser(overrides: Partial<{ email: string; password: string; name: string }> = {}) {
  const id = randomUUID().slice(0, 8);
  return { email: `e2e-${id}@example.com`, password: `Pa55-${id}`, name: 'Тестовый Покупатель', ...overrides };
}

export function newRecipient() {
  return { name: 'Иван Петров', phone: VALID_PHONE, address: 'Москва, ул. Тверская, д. 1, кв. 1' };
}
