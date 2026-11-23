import { test, expect } from '../fixtures';
import { PRODUCTS } from '../support/data';
import { money } from '../support/money';

test.describe('Корзина', () => {
  test('добавление из каталога: уведомление и счётчик в шапке @smoke', async ({ catalog, header, api }) => {
    await catalog.open();
    await header.expectCartCount(0);

    await catalog.addButton(catalog.cardById(PRODUCTS.ethiopia)).click();
    await header.expectToast('Товар добавлен в корзину');
    await header.expectCartCount(1);

    await catalog.addButton(catalog.cardById(PRODUCTS.ethiopia)).click();
    await header.expectCartCount(2);
    expect((await api.cart()).items).toEqual([expect.objectContaining({ productId: PRODUCTS.ethiopia, qty: 2 })]);
  });

  test('добавление нескольких штук с карточки товара', async ({ productPage, cart, header, api }) => {
    const product = await api.product(PRODUCTS.chocolate);
    await productPage.open(product.id);

    await productPage.plus.click();
    await productPage.plus.click();
    await expect(productPage.qty).toHaveValue('3');
    await productPage.minus.click();
    await expect(productPage.qty).toHaveValue('2');
    await productPage.add();

    await header.expectToast('Товар добавлен в корзину');
    await header.expectCartCount(2);

    await cart.open();
    await expect(cart.rows).toHaveCount(1);
    await expect(cart.qtyInput(product.id)).toHaveValue('2');
    expect(await cart.rowSum(product.id)).toBe(product.price * 2);
  });

  test('«−» на карточке товара не опускает количество ниже 1', async ({ productPage }) => {
    await productPage.open(PRODUCTS.chocolate);
    await productPage.minus.click();
    await expect(productPage.qty).toHaveValue('1');
  });

  test('отображает позиции и считает итог по нескольким товарам', async ({ api, cart }) => {
    const [a, b] = await Promise.all([api.product(PRODUCTS.ethiopia), api.product(PRODUCTS.filters)]);
    await api.fillCart({ [a.id]: 2, [b.id]: 3 });
    await cart.open();

    await expect(cart.rows).toHaveCount(2);
    await expect(cart.row(a.id)).toContainText(a.name);
    expect(await cart.rowSum(a.id)).toBe(a.price * 2);
    expect(await cart.rowSum(b.id)).toBe(b.price * 3);
    expect(await cart.totals()).toEqual({ subtotal: a.price * 2 + b.price * 3, discount: 0, total: a.price * 2 + b.price * 3 });
  });

  test('изменение количества кнопками и вручную пересчитывает суммы', async ({ api, cart, header }) => {
    const p = await api.product(PRODUCTS.filters);
    await api.addToCart(p.id, 1);
    await cart.open();

    await cart.increase(p.id);
    await expect(cart.qtyInput(p.id)).toHaveValue('2');
    await expect(cart.total).toHaveText(money(p.price * 2));

    await cart.setQty(p.id, 5);
    await expect(cart.qtyInput(p.id)).toHaveValue('5');
    await expect(cart.subtotal).toHaveText(money(p.price * 5));
    await header.expectCartCount(5);

    await cart.decrease(p.id);
    await expect(cart.qtyInput(p.id)).toHaveValue('4');
    await expect(cart.total).toHaveText(money(p.price * 4));
  });

  test('уменьшение количества до нуля удаляет позицию', async ({ api, cart }) => {
    await api.addToCart(PRODUCTS.filters, 1);
    await cart.open();
    await cart.decrease(PRODUCTS.filters);
    await expect(cart.empty).toBeVisible();
  });

  test('нельзя добавить больше, чем есть на складе', async ({ api, productPage, cart, header }) => {
    const kettle = await api.product(PRODUCTS.kettle);
    expect(kettle.stock).toBeGreaterThan(0);

    // С карточки товара — сразу больше остатка
    await productPage.open(kettle.id);
    await productPage.add(kettle.stock + 1);
    await header.expectErrorToast(`В наличии только ${kettle.stock} шт.`);
    await header.expectCartCount(0);

    // В корзине — «+» сверх остатка
    await api.addToCart(kettle.id, kettle.stock);
    await cart.open();
    await cart.increase(kettle.id);
    await header.expectErrorToast(`В наличии только ${kettle.stock} шт.`);
    await expect(cart.qtyInput(kettle.id)).toHaveValue(String(kettle.stock));
  });

  test('удаление позиции и очистка корзины', async ({ api, cart, header }) => {
    await api.fillCart({ [PRODUCTS.filters]: 1, [PRODUCTS.chocolate]: 2 });
    await cart.open();

    await cart.remove(PRODUCTS.filters);
    await expect(cart.rows).toHaveCount(1);
    await expect(cart.row(PRODUCTS.filters)).toHaveCount(0);
    await header.expectCartCount(2);

    await cart.clear();
    await expect(cart.empty).toContainText('В корзине пока пусто');
    await header.expectCartCount(0);
    await expect(cart.checkoutLink).toHaveCount(0);
  });

  test('корзина сохраняется после перезагрузки страницы', async ({ api, cart, header, page }) => {
    await api.addToCart(PRODUCTS.chocolate, 3);
    await cart.open();
    await page.reload();
    await expect(cart.rows).toHaveCount(1);
    await header.expectCartCount(3);
  });

  test('корзины разных покупателей изолированы', async ({ api, browser, baseURL }) => {
    await api.addToCart(PRODUCTS.chocolate, 2);

    const other = await browser.newContext({ baseURL });
    try {
      const page = await other.newPage();
      await page.goto('/#/cart');
      await expect(page.getByTestId('cart-empty')).toBeVisible();
      await expect(page.getByTestId('cart-count')).toHaveText('0');
    } finally {
      await other.close();
    }
  });
});
