import { test, expect } from '../fixtures';
import { DELIVERY, PRODUCTS, PROMO, newRecipient } from '../support/data';

test.describe('Оформление заказа', () => {
  test('курьерская доставка: полный сценарий от каталога до заказа @smoke', async ({
    page, catalog, header, cart, checkout, orderPage, api,
  }) => {
    const product = await api.product(PRODUCTS.filters);
    const recipient = newRecipient();

    await catalog.open();
    await catalog.addButton(catalog.cardById(product.id)).click();
    await header.expectCartCount(1);
    await header.cartLink.click();
    await expect(cart.rows).toHaveCount(1);
    await cart.checkoutLink.click();

    await expect(checkout.heading).toBeVisible();
    await expect(checkout.courier).toBeChecked(); // значения по умолчанию
    await expect(checkout.card).toBeChecked();
    expect(await checkout.shippingCost()).toBe(DELIVERY.price);

    await checkout.fill({ ...recipient, payment: 'cash', comment: 'Позвонить за час' });
    const response = await checkout.placeOrder();
    expect(response.status()).toBe(201);
    const order = await response.json();

    await expect(page).toHaveURL(new RegExp(`#/order/${order.id}$`));
    await expect(orderPage.success).toContainText(`Заказ №${order.id} оформлен`);
    await expect(orderPage.success).toContainText(recipient.phone);
    await expect(orderPage.items).toHaveCount(1);
    await expect(orderPage.items.first()).toContainText(product.name);
    expect(await orderPage.totalValue()).toBe(product.price + DELIVERY.price);
    await expect(orderPage.details).toContainText(`Доставка курьером: ${recipient.address}`);
    await expect(orderPage.details).toContainText('Оплата: наличными');

    // Корзина очищена
    await header.expectCartCount(0);
    expect((await api.cart()).items).toEqual([]);
  });

  test('самовывоз: адрес не нужен, доставка бесплатно', async ({ api, checkout, orderPage }) => {
    const p = await api.product(PRODUCTS.filters);
    await api.addToCart(p.id, 1);
    await checkout.open();

    await checkout.chooseDelivery('pickup');
    // Видимость поля адреса — BUG-13 (known-bugs.spec.ts)
    await expect(checkout.page.locator('#address-row')).toHaveAttribute('hidden');
    await expect(checkout.shipping).toHaveText('бесплатно');
    expect(await checkout.shippingCost()).toBe(0);

    await checkout.fill({ name: 'Анна', phone: '89001234567' });
    await checkout.placeOrder();
    await expect(orderPage.success).toBeVisible();
    await expect(orderPage.details).toContainText('Самовывоз');
    await expect(orderPage.details).toContainText('Оплата: картой при получении');
    expect(await orderPage.totalValue()).toBe(p.price);
  });

  test('переключение способа доставки пересчитывает итог', async ({ api, checkout }) => {
    const p = await api.product(PRODUCTS.filters);
    await api.addToCart(p.id, 1);
    await checkout.open();

    await expect(checkout.total).toContainText(String(p.price + DELIVERY.price));
    await checkout.chooseDelivery('pickup');
    expect(await checkout.shippingCost()).toBe(0);
    await checkout.chooseDelivery('courier');
    await expect(checkout.address).toBeVisible();
    await expect(checkout.page.locator('#address-row')).not.toHaveAttribute('hidden');
    expect(await checkout.shippingCost()).toBe(DELIVERY.price);
  });

  test.describe('Стоимость курьерской доставки', () => {
    test('бесплатно при сумме ровно 3000 ₽ (граница)', async ({ api, checkout }) => {
      // 2×890 + 2×450 + 320 = 3000
      const cart = await api.fillCart({ [PRODUCTS.ethiopia]: 2, [PRODUCTS.filters]: 2, [PRODUCTS.chocolate]: 1 });
      expect(cart.total).toBe(DELIVERY.freeFrom);
      await checkout.open();
      expect(await checkout.shippingCost()).toBe(0);
    });

    test('300 ₽ при сумме меньше 3000 ₽', async ({ api, checkout }) => {
      // 2×890 + 2×450 = 2680
      const cart = await api.fillCart({ [PRODUCTS.ethiopia]: 2, [PRODUCTS.filters]: 2 });
      expect(cart.total).toBeLessThan(DELIVERY.freeFrom);
      await checkout.open();
      expect(await checkout.shippingCost()).toBe(DELIVERY.price);
    });

    test('порог считается по сумме после скидки', async ({ api, checkout }) => {
      // 2150 + 2×450 = 3050 → −500 = 2550 → доставка платная
      await api.fillCart({ [PRODUCTS.brazil]: 1, [PRODUCTS.filters]: 2 });
      const cart = await api.applyPromo(PROMO.fixed);
      expect(cart.subtotal).toBeGreaterThanOrEqual(DELIVERY.freeFrom);
      expect(cart.total).toBeLessThan(DELIVERY.freeFrom);

      await checkout.open();
      expect(await checkout.shippingCost()).toBe(DELIVERY.price);
    });

    test('после скидки ровно 3000 ₽ — бесплатно', async ({ api, checkout }) => {
      // 2150 + 3×450 = 3500 → −500 = 3000
      await api.fillCart({ [PRODUCTS.brazil]: 1, [PRODUCTS.filters]: 3 });
      expect((await api.applyPromo(PROMO.fixed)).total).toBe(DELIVERY.freeFrom);
      await checkout.open();
      expect(await checkout.shippingCost()).toBe(0);
    });
  });

  test.describe('Валидация формы', () => {
    test.beforeEach(async ({ api, checkout }) => {
      await api.addToCart(PRODUCTS.filters, 1);
      await checkout.open();
    });

    test('пустая форма: ошибки у обязательных полей, заказ не создаётся', async ({ checkout, page }) => {
      const response = await checkout.placeOrder();
      expect(response.status()).toBe(400);
      await expect(checkout.formError).toHaveText('Проверьте поля формы');
      await expect(checkout.fieldError('name')).toHaveText('Укажите имя получателя');
      await expect(checkout.fieldError('phone')).toHaveText('Укажите телефон в формате +7 900 000-00-00');
      await expect(checkout.fieldError('address')).toHaveText('Укажите адрес доставки');
      await expect(page).toHaveURL(/#\/checkout$/);
      await expect(checkout.submit).toBeEnabled(); // можно исправить и отправить повторно
    });

    for (const phone of ['123', '+7 900 abc-de-fg', '+7 900 000-00-00-00-00-00']) {
      test(`некорректный телефон «${phone}»`, async ({ checkout }) => {
        await checkout.fill({ ...newRecipient(), phone });
        await checkout.placeOrder();
        await expect(checkout.fieldError('phone')).toBeVisible();
        await expect(checkout.fieldError('name')).toHaveCount(0);
      });
    }

    test('имя из одного символа и адрес из пробелов не принимаются', async ({ checkout }) => {
      await checkout.fill({ ...newRecipient(), name: 'Я', address: '      ' });
      await checkout.placeOrder();
      await expect(checkout.fieldError('name')).toBeVisible();
      await expect(checkout.fieldError('address')).toBeVisible();
    });

    test('после исправления ошибок заказ оформляется', async ({ checkout, orderPage }) => {
      await checkout.placeOrder();
      await expect(checkout.fieldError('name')).toBeVisible();
      await checkout.fill(newRecipient());
      await checkout.placeOrder();
      await expect(orderPage.success).toBeVisible();
    });
  });

  test('остаток товара уменьшается после заказа', async ({ api }) => {
    const before = (await api.product(PRODUCTS.chocolate)).stock;
    await api.addToCart(PRODUCTS.chocolate, 2);
    await api.placeOrder({ ...newRecipient(), delivery: 'courier', payment: 'card' });
    // На «живом» стенде параллельно могут покупать — проверяем «не больше чем».
    expect((await api.product(PRODUCTS.chocolate)).stock).toBeLessThanOrEqual(before - 2);
  });

  test('пустую корзину нельзя оформить — переход на корзину', async ({ page, cart }) => {
    await page.goto('/#/checkout');
    await expect(page).toHaveURL(/#\/cart$/);
    await expect(cart.empty).toBeVisible();
  });

  test('имя получателя подставляется для авторизованного пользователя', async ({ loggedInUser, api, checkout }) => {
    await api.addToCart(PRODUCTS.filters, 1);
    await checkout.open();
    await expect(checkout.name).toHaveValue(loggedInUser.name);
  });

  test('чужой заказ недоступен по прямой ссылке', async ({ api, browser, baseURL }) => {
    await api.addToCart(PRODUCTS.filters, 1);
    const order = await api.placeOrder({ ...newRecipient(), delivery: 'pickup', payment: 'cash' });

    const stranger = await browser.newContext({ baseURL });
    try {
      const page = await stranger.newPage();
      await page.goto(`/#/order/${order.id}`);
      await expect(page.getByRole('heading', { name: 'Заказ не найден' })).toBeVisible();
      await expect(page.getByText(newRecipient().phone)).toHaveCount(0);
    } finally {
      await stranger.close();
    }
  });
});
