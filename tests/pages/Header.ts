import { expect, type Locator, type Page } from '@playwright/test';

export class Header {
  readonly root: Locator;
  readonly catalogLink: Locator;
  readonly cartLink: Locator;
  readonly cartCount: Locator;
  readonly loginLink: Locator;
  readonly logoutButton: Locator;
  readonly ordersLink: Locator;
  readonly userName: Locator;
  readonly toast: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole('banner');
    this.catalogLink = this.root.getByRole('link', { name: 'Каталог' });
    this.cartLink = page.getByTestId('cart-link');
    this.cartCount = page.getByTestId('cart-count');
    this.loginLink = page.locator('#nav-login');
    // id-локаторы: getByRole не находит элементы с hidden, а нам нужно проверять и этот атрибут
    this.logoutButton = page.locator('#nav-logout');
    this.ordersLink = page.locator('#nav-orders');
    this.userName = page.locator('#user-name');
    this.toast = page.getByRole('status');
  }

  async expectCartCount(n: number) {
    await expect(this.cartCount).toHaveText(String(n));
  }

  async expectToast(text: string | RegExp) {
    await expect(this.toast).toBeVisible();
    await expect(this.toast).toHaveText(text);
  }

  async expectErrorToast(text: string | RegExp) {
    await this.expectToast(text);
    await expect(this.toast).toHaveClass(/error/);
  }

  /*
   * Состояние шапки проверяем по атрибуту hidden, который выставляет приложение.
   * Фактическую видимость «Выйти» и «Мои заказы» проверяют отдельные тесты
   * в known-bugs.spec.ts (BUG-12, BUG-14) — из-за CSS она расходится с атрибутом.
   */
  async expectLoggedInAs(name: string) {
    await expect(this.userName).toHaveText(name);
    await expect(this.userName).toBeVisible();
    await expect(this.loginLink).toBeHidden();
    await expect(this.logoutButton).not.toHaveAttribute('hidden');
    await expect(this.ordersLink).not.toHaveAttribute('hidden');
  }

  async expectLoggedOut() {
    await expect(this.loginLink).toBeVisible();
    await expect(this.userName).toBeHidden();
    await expect(this.logoutButton).toHaveAttribute('hidden');
    await expect(this.ordersLink).toHaveAttribute('hidden');
  }
}
