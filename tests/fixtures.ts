import { test as base, expect } from '@playwright/test';
import { ShopApi } from './support/api';
import { newUser } from './support/data';
import { Header } from './pages/Header';
import { CatalogPage } from './pages/CatalogPage';
import { ProductPage } from './pages/ProductPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderPage, OrdersListPage } from './pages/OrderPages';
import { AuthPage } from './pages/AuthPage';

type User = ReturnType<typeof newUser>;

interface Fixtures {
  /** API в той же сессии (cookie), что и браузерная вкладка. */
  api: ShopApi;
  header: Header;
  catalog: CatalogPage;
  productPage: ProductPage;
  cart: CartPage;
  checkout: CheckoutPage;
  orderPage: OrderPage;
  ordersList: OrdersListPage;
  auth: AuthPage;
  /** Зарегистрированный через API и авторизованный в браузере пользователь. */
  loggedInUser: User;
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    // Любая необработанная JS-ошибка на странице — это баг, даже если сценарий «прошёл».
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await use(page);
    expect(errors, 'JS-ошибки на странице').toEqual([]);
  },
  api: async ({ page }, use) => use(new ShopApi(page.request)),
  header: async ({ page }, use) => use(new Header(page)),
  catalog: async ({ page }, use) => use(new CatalogPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cart: async ({ page }, use) => use(new CartPage(page)),
  checkout: async ({ page }, use) => use(new CheckoutPage(page)),
  orderPage: async ({ page }, use) => use(new OrderPage(page)),
  ordersList: async ({ page }, use) => use(new OrdersListPage(page)),
  auth: async ({ page }, use) => use(new AuthPage(page)),
  loggedInUser: async ({ api }, use) => {
    const user = newUser();
    await api.register(user); // регистрация сразу авторизует сессию
    await use(user);
  },
});

export { expect };
