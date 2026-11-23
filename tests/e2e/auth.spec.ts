import { test, expect } from '../fixtures';
import { PRODUCTS, newRecipient, newUser } from '../support/data';

test.describe('Регистрация', () => {
  test('новый пользователь регистрируется и сразу авторизован @smoke', async ({ auth, header, page }) => {
    const user = newUser();
    await auth.openRegister();
    const response = await auth.register(user);

    expect(response.status()).toBe(201);
    await header.expectToast('Вы зарегистрированы');
    await expect(page).toHaveURL(/#\/$/);
    await header.expectLoggedInAs(user.name);
  });

  test('валидация полей', async ({ auth }) => {
    await auth.openRegister();
    await auth.register({ name: 'Я', email: 'not-an-email', password: '12345' });

    await expect(auth.formError).toHaveText('Проверьте поля формы');
    await expect(auth.fieldError('name')).toHaveText('Укажите имя');
    await expect(auth.fieldError('email')).toHaveText('Укажите корректный e-mail');
    await expect(auth.fieldError('password')).toHaveText('Пароль должен быть не короче 6 символов');
  });

  test('пароль из 6 символов — минимально допустимый', async ({ auth, header }) => {
    const user = newUser({ password: 'abc123' });
    await auth.openRegister();
    await auth.register(user);
    await header.expectLoggedInAs(user.name);
  });

  test('повторная регистрация на тот же e-mail (в другом регистре) запрещена', async ({ auth, browser, baseURL }) => {
    const user = newUser();
    // Регистрируем в отдельной сессии, чтобы текущая вкладка осталась гостевой
    const ctx = await browser.newContext({ baseURL });
    await ctx.request.post('/api/auth/register', { data: user });
    await ctx.close();

    await auth.openRegister();
    const response = await auth.register({ ...user, email: user.email.toUpperCase() });
    expect(response.status()).toBe(409);
    await expect(auth.formError).toHaveText('Пользователь с таким e-mail уже зарегистрирован');
    await expect(auth.fieldError('email')).toHaveText('E-mail уже занят');
  });

  test('переходы между формами входа и регистрации', async ({ auth, page }) => {
    await auth.openLogin();
    await auth.toRegister.click();
    await expect(page).toHaveURL(/#\/register$/);
    await auth.toLogin.click();
    await expect(page).toHaveURL(/#\/login$/);
  });
});

test.describe('Вход и выход', () => {
  // Пользователь создаётся через API в отдельном контексте — браузер остаётся гостем.
  let user: ReturnType<typeof newUser>;
  test.beforeEach(async ({ browser, baseURL }) => {
    user = newUser();
    const ctx = await browser.newContext({ baseURL });
    const res = await ctx.request.post('/api/auth/register', { data: user });
    expect(res.status()).toBe(201);
    await ctx.close();
  });

  test('вход с верными данными @smoke', async ({ auth, header, page }) => {
    await auth.openLogin();
    await header.expectLoggedOut();
    const response = await auth.login(user.email, user.password);

    expect(response.status()).toBe(200);
    await header.expectToast('Вы вошли');
    await expect(page).toHaveURL(/#\/$/);
    await header.expectLoggedInAs(user.name);
  });

  test('e-mail при входе не чувствителен к регистру и пробелам', async ({ auth, header }) => {
    await auth.openLogin();
    await auth.login(`  ${user.email.toUpperCase()} `, user.password);
    await header.expectLoggedInAs(user.name);
  });

  test('неверный пароль', async ({ auth, header }) => {
    await auth.openLogin();
    const response = await auth.login(user.email, `${user.password}-wrong`);
    expect(response.status()).toBe(401);
    await expect(auth.formError).toHaveText('Неверный e-mail или пароль');
    await header.expectLoggedOut();
  });

  test('несуществующий пользователь — та же ошибка (без раскрытия наличия e-mail)', async ({ auth }) => {
    await auth.openLogin();
    await auth.login(newUser().email, user.password);
    await expect(auth.formError).toHaveText('Неверный e-mail или пароль');
  });

  test('сессия сохраняется после перезагрузки', async ({ auth, header, page }) => {
    await auth.openLogin();
    await auth.login(user.email, user.password);
    await header.expectLoggedInAs(user.name);
    await page.reload();
    await header.expectLoggedInAs(user.name);
  });

  test('выход из аккаунта', async ({ auth, header, page }) => {
    await auth.openLogin();
    await auth.login(user.email, user.password);
    await header.expectLoggedInAs(user.name);

    await header.logoutButton.click();
    await header.expectToast('Вы вышли');
    await header.expectLoggedOut();

    // «Мои заказы» для гостя ведут на вход
    await page.goto('/#/orders');
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('корзина гостя сохраняется после входа', async ({ api, auth, header }) => {
    await api.addToCart(PRODUCTS.filters, 2);
    await auth.openLogin();
    await auth.login(user.email, user.password);
    await header.expectLoggedInAs(user.name);
    await header.expectCartCount(2);
  });
});

test.describe('Мои заказы', () => {
  test('новый пользователь видит пустую историю', async ({ loggedInUser: _user, ordersList }) => {
    await ordersList.open();
    await expect(ordersList.heading).toBeVisible();
    await expect(ordersList.empty).toBeVisible();
  });

  test('оформленный заказ появляется в истории и открывается', async ({ loggedInUser: _user, api, header, ordersList, orderPage, page }) => {
    await api.addToCart(PRODUCTS.filters, 2);
    const first = await api.placeOrder({ ...newRecipient(), delivery: 'pickup', payment: 'card' });
    await api.addToCart(PRODUCTS.chocolate, 1);
    const second = await api.placeOrder({ ...newRecipient(), delivery: 'courier', payment: 'cash' });

    await page.goto('/#/');
    await header.ordersLink.click();
    await expect(ordersList.rows).toHaveCount(2);
    // Новые — сверху
    await expect(ordersList.rows.first()).toContainText(`№${second.id}`);
    await expect(ordersList.row(first.id)).toContainText('2'); // количество товаров
    await expect(ordersList.row(first.id)).toContainText(String(first.total));

    await ordersList.row(first.id).getByRole('link').click();
    await expect(orderPage.success).toBeVisible();
    expect(await orderPage.id()).toBe(first.id);
  });

  test('пользователь не видит чужие заказы', async ({ page, browser, baseURL, ordersList, loggedInUser: _user }) => {
    // Другой пользователь оформляет заказ
    const other = await browser.newContext({ baseURL });
    try {
      await other.request.post('/api/auth/register', { data: newUser() });
      await other.request.post('/api/cart/items', { data: { productId: PRODUCTS.filters, qty: 1 } });
      const res = await other.request.post('/api/orders', { data: { ...newRecipient(), delivery: 'pickup', payment: 'cash' } });
      const foreign = await res.json();

      await ordersList.open();
      await expect(ordersList.empty).toBeVisible();
      const direct = await page.request.get(`/api/orders/${foreign.id}`);
      expect(direct.status()).toBe(404);
    } finally {
      await other.close();
    }
  });
});
