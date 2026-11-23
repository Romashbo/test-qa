import { test, expect } from '../fixtures';
import { PRODUCTS, PROMO, newRecipient, newUser } from '../support/data';

/**
 * Регрессионные тесты на найденные баги (описаны в README → «Найденные баги»).
 *
 * Каждый тест проверяет ОЖИДАЕМОЕ поведение и помечен test.fail():
 *  - пока баг есть — тест «ожидаемо падает», прогон зелёный;
 *  - когда баг исправят — тест неожиданно пройдёт, Playwright подсветит это,
 *    и пометку test.fail() нужно снять — тест превращается в обычный регресс.
 */
const bug = (id: string, title: string) => ({ annotation: { type: 'bug', description: `${id}: ${title}` } });

test.describe('Известные баги', () => {
  test('BUG-01: количество 0 на карточке товара не должно добавлять товар', bug('BUG-01', 'qty 0 → в корзину добавляется 1 шт.'), async ({ productPage, header }) => {
    test.fail();
    await productPage.open(PRODUCTS.chocolate);
    await productPage.add(0);
    await header.expectErrorToast('Некорректное количество');
    await header.expectCartCount(0);
  });

  test('BUG-01: API — qty: 0 должен отклоняться с 400', bug('BUG-01', 'qty 0 → в корзину добавляется 1 шт.'), async ({ page }) => {
    test.fail();
    const res = await page.request.post('/api/cart/items', { data: { productId: PRODUCTS.chocolate, qty: 0 } });
    expect(res.status()).toBe(400);
  });

  test('BUG-02: промокод не должен «оживать» после опустошения корзины', bug('BUG-02', 'промокод остаётся в сессии и применяется к новой корзине'), async ({ api, cart }) => {
    test.fail();
    await api.addToCart(PRODUCTS.certificate, 1);
    await api.applyPromo(PROMO.fixed);
    await cart.open();
    await cart.remove(PRODUCTS.certificate); // корзина пуста, промокод в поле не отображается
    await expect(cart.empty).toBeVisible();

    // Новая покупка — пользователь промокод не вводил
    await api.addToCart(PRODUCTS.certificate, 2);
    await cart.open();
    await expect(cart.discount).toHaveCount(0);
  });

  test('BUG-03: поиск должен находить «чёрный» по запросу «черный»', bug('BUG-03', 'поиск не нормализует ё/е'), async ({ catalog }) => {
    test.fail();
    await catalog.open();
    await catalog.searchFor('черный');
    await expect(catalog.cardById(PRODUCTS.assam)).toBeVisible();
  });

  test('BUG-04: телефон без цифр абонента не должен приниматься', bug('BUG-04', 'валидация телефона пропускает «7---------»'), async ({ api, checkout }) => {
    test.fail();
    await api.addToCart(PRODUCTS.filters, 1);
    await checkout.open();
    await checkout.fill({ ...newRecipient(), phone: '7---------' });
    const response = await checkout.placeOrder();
    expect(response.status()).toBe(400);
    await expect(checkout.fieldError('phone')).toBeVisible();
  });

  test('BUG-05: битая cookie не должна ронять API в 500', bug('BUG-05', 'decodeURIComponent в parseCookies бросает исключение'), async ({ playwright, baseURL }) => {
    test.fail();
    const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: 'sid=%E0%A4%A' } });
    try {
      const res = await ctx.get('/api/products');
      expect(res.status()).toBe(200);
    } finally {
      await ctx.dispose();
    }
  });

  test('BUG-06: запросы без cookie не должны плодить сессии', bug('BUG-06', 'утечка памяти: сессия на каждый запрос без cookie'), async ({ baseURL }) => {
    test.fail();
    // Голый fetch без cookie-jar — так ходят health-check'и, мониторинг и боты
    const sessions = async () => {
      const metrics = await (await fetch(new URL('/metrics', baseURL))).text();
      return Number(/^shop_active_sessions (\d+)/m.exec(metrics)![1]);
    };
    const before = await sessions();
    for (let i = 0; i < 20; i++) await fetch(new URL('/api/health', baseURL));
    // Допускаем рост от параллельно идущих тестов, но не на 20 «пустых» сессий
    expect(await sessions()).toBeLessThan(before + 20);
  });

  test('BUG-07: «+» на карточке товара не должен превышать остаток', bug('BUG-07', 'количество на карточке не ограничено остатком'), async ({ api, productPage }) => {
    test.fail();
    const kettle = await api.product(PRODUCTS.kettle);
    await productPage.open(kettle.id);
    for (let i = 0; i < kettle.stock + 2; i++) await productPage.plus.click();
    await expect(productPage.qty).toHaveValue(String(kettle.stock));
  });

  test('BUG-08: пароль из одних пробелов не должен приниматься', bug('BUG-08', 'пароль «      » проходит валидацию'), async ({ auth }) => {
    test.fail();
    await auth.openRegister();
    const response = await auth.register(newUser({ password: '      ' }));
    expect(response.status()).toBe(400);
    await expect(auth.fieldError('password')).toBeVisible();
  });

  test('BUG-09: при входе идентификатор сессии должен меняться', bug('BUG-09', 'session fixation — sid не ротируется при логине'), async ({ page, context, browser, baseURL }) => {
    test.fail();
    const user = newUser();
    const reg = await browser.newContext({ baseURL });
    await reg.request.post('/api/auth/register', { data: user });
    await reg.close();

    await page.goto('/');
    const sidBefore = (await context.cookies()).find((c) => c.name === 'sid')?.value;
    await page.request.post('/api/auth/login', { data: { email: user.email, password: user.password } });
    const sidAfter = (await context.cookies()).find((c) => c.name === 'sid')?.value;
    expect(sidBefore).toBeTruthy();
    expect(sidAfter).not.toBe(sidBefore);
  });

  test('BUG-10: после выхода заказ пользователя не должен открываться в этом браузере', bug('BUG-10', 'доступ к заказу по sid сохраняется после logout'), async ({ api, loggedInUser: _user, page, orderPage }) => {
    test.fail();
    await api.addToCart(PRODUCTS.filters, 1);
    const order = await api.placeOrder({ ...newRecipient(), delivery: 'pickup', payment: 'cash' });
    await page.request.post('/api/auth/logout');

    await orderPage.open(order.id);
    await expect(orderPage.notFound).toBeVisible();
  });

  test('BUG-11: API — нецелые/нечисловые qty должны отклоняться', bug('BUG-11', 'qty "1e1" и true принимаются'), async ({ page }) => {
    test.fail();
    for (const qty of ['1e1', true]) {
      const res = await page.request.post('/api/cart/items', { data: { productId: PRODUCTS.filters, qty } });
      expect(res.status(), `qty=${JSON.stringify(qty)}`).toBe(400);
    }
  });

  test('BUG-12: гость не должен видеть кнопку «Выйти»', bug('BUG-12', 'CSS button{display:inline-block} перебивает атрибут hidden'), async ({ catalog, header }) => {
    test.fail();
    await catalog.open();
    await expect(header.loginLink).toBeVisible();
    await expect(header.logoutButton).toBeHidden();
  });

  test('BUG-13: при самовывозе поле адреса должно скрываться', bug('BUG-13', 'CSS .form label{display:grid} перебивает атрибут hidden'), async ({ api, checkout }) => {
    test.fail();
    await api.addToCart(PRODUCTS.filters, 1);
    await checkout.open();
    await checkout.chooseDelivery('pickup');
    await expect(checkout.address).toBeHidden();
  });
});

test.describe('Известные баги — мобильная версия', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('BUG-14: на телефоне должен быть доступен переход в «Мои заказы»', bug('BUG-14', 'при ширине ≤720px навигация скрыта (.nav{display:none}) без альтернативы'), async ({ loggedInUser: _user, catalog, header }) => {
    test.fail();
    await catalog.open();
    await expect(header.ordersLink).toBeVisible();
  });
});
