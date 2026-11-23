import { test, expect } from '../fixtures';
import { PRODUCTS, PROMO } from '../support/data';

test.describe('Промокоды', () => {
  test(`${PROMO.percent} даёт скидку 10 % @smoke`, async ({ api, cart, header }) => {
    const p = await api.product(PRODUCTS.ethiopia);
    await api.addToCart(p.id, 3); // 2670 ₽
    await cart.open();

    await cart.applyPromo(PROMO.percent);
    await header.expectToast('Промокод применён');
    const subtotal = p.price * 3;
    const discount = Math.round(subtotal * 0.1);
    expect(await cart.totals()).toEqual({ subtotal, discount, total: subtotal - discount });
    await expect(cart.discount.locator('..')).toContainText(`Скидка (${PROMO.percent})`);
    await expect(cart.promoInput).toHaveValue(PROMO.percent);
  });

  test('код не зависит от регистра и пробелов', async ({ api, cart }) => {
    await api.addToCart(PRODUCTS.ethiopia, 1);
    await cart.open();
    await cart.applyPromo(`  ${PROMO.percent.toLowerCase()} `);
    await expect(cart.discount).toBeVisible();
    await expect(cart.promoInput).toHaveValue(PROMO.percent);
  });

  test(`${PROMO.fixed} даёт −500 ₽ при сумме от 2000 ₽ (граница: ровно 2000 ₽)`, async ({ api, cart }) => {
    const cert = await api.product(PRODUCTS.certificate);
    expect(cert.price).toBe(PROMO.fixedMin);
    await api.addToCart(cert.id, 1);
    await cart.open();

    await cart.applyPromo(PROMO.fixed);
    expect(await cart.totals()).toEqual({ subtotal: 2000, discount: 500, total: 1500 });
  });

  test(`${PROMO.fixed} не применяется при сумме меньше 2000 ₽`, async ({ api, cart, header }) => {
    const p = await api.product(PRODUCTS.ethiopia);
    await api.addToCart(p.id, 2); // 1780 ₽
    await cart.open();

    await cart.applyPromo(PROMO.fixed);
    await header.expectErrorToast('Промокод действует при заказе от 2000 ₽');
    await expect(cart.discount).toHaveCount(0);
    expect((await cart.totals()).total).toBe(p.price * 2);
  });

  test('несуществующий промокод', async ({ api, cart, header }) => {
    await api.addToCart(PRODUCTS.ethiopia, 1);
    await cart.open();
    await cart.applyPromo('NOSUCHCODE');
    await header.expectErrorToast('Промокод не найден');
    await expect(cart.discount).toHaveCount(0);
  });

  test('промокоды не суммируются: новый заменяет предыдущий', async ({ api, cart }) => {
    await api.addToCart(PRODUCTS.certificate, 2); // 4000 ₽
    await cart.open();

    await cart.applyPromo(PROMO.percent);
    expect((await cart.totals()).discount).toBe(400);
    await cart.applyPromo(PROMO.fixed);
    expect(await cart.totals()).toEqual({ subtotal: 4000, discount: 500, total: 3500 });
  });

  test('пустой код сбрасывает промокод', async ({ api, cart, header }) => {
    await api.addToCart(PRODUCTS.ethiopia, 1);
    await api.applyPromo(PROMO.percent);
    await cart.open();
    await expect(cart.discount).toBeVisible();

    await cart.applyPromo('');
    await header.expectToast('Промокод сброшен');
    await expect(cart.discount).toHaveCount(0);
  });

  test('скидка пересчитывается при изменении корзины', async ({ api, cart }) => {
    const p = await api.product(PRODUCTS.ethiopia);
    await api.addToCart(p.id, 1);
    await api.applyPromo(PROMO.percent);
    await cart.open();

    await cart.setQty(p.id, 4);
    const subtotal = p.price * 4;
    expect(await cart.totals()).toEqual({ subtotal, discount: Math.round(subtotal * 0.1), total: subtotal - Math.round(subtotal * 0.1) });
  });

  test(`${PROMO.fixed} перестаёт действовать, если сумма опустилась ниже 2000 ₽`, async ({ api, cart }) => {
    await api.addToCart(PRODUCTS.ethiopia, 3); // 2670 ₽
    await api.applyPromo(PROMO.fixed);
    await cart.open();
    expect((await cart.totals()).discount).toBe(500);

    await cart.setQty(PRODUCTS.ethiopia, 2); // 1780 ₽
    expect(await cart.totals()).toEqual({ subtotal: 1780, discount: 0, total: 1780 });
  });

  test('скидка переносится в оформление и в заказ', async ({ api, checkout, orderPage }) => {
    await api.addToCart(PRODUCTS.certificate, 1);
    await api.applyPromo(PROMO.fixed);
    await checkout.open();
    await checkout.fill({ name: 'Иван', phone: '+7 900 000-00-00', delivery: 'pickup' });

    await expect(checkout.discount).toBeVisible();
    await checkout.placeOrder();
    await expect(orderPage.success).toBeVisible();
    await expect(orderPage.discount.locator('..')).toContainText(PROMO.fixed);
    expect(await orderPage.totalValue()).toBe(1500);
  });
});
