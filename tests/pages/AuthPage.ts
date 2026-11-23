import { expect, type Locator, type Page } from '@playwright/test';
import { openRoute } from '../support/navigation';

export class AuthPage {
  readonly form: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly registerButton: Locator;
  readonly formError: Locator;
  readonly toRegister: Locator;
  readonly toLogin: Locator;

  constructor(readonly page: Page) {
    this.form = page.locator('form#auth');
    this.name = this.form.getByLabel('Имя', { exact: true });
    this.email = this.form.getByLabel('E-mail');
    this.password = this.form.getByLabel('Пароль');
    this.loginButton = this.form.getByRole('button', { name: 'Войти' });
    this.registerButton = this.form.getByRole('button', { name: 'Зарегистрироваться' });
    this.formError = this.form.getByRole('alert');
    this.toRegister = this.form.getByRole('link', { name: 'Зарегистрироваться' });
    this.toLogin = this.form.getByRole('link', { name: 'Войти' });
  }

  fieldError(field: 'name' | 'email' | 'password'): Locator {
    return this.form.locator(`.field-error[data-field="${field}"]`);
  }

  async openLogin() {
    await openRoute(this.page, '/#/login');
    await expect(this.page.getByRole('heading', { level: 1, name: 'Вход' })).toBeVisible();
  }

  async openRegister() {
    await openRoute(this.page, '/#/register');
    await expect(this.page.getByRole('heading', { level: 1, name: 'Регистрация' })).toBeVisible();
  }

  async register(user: { name: string; email: string; password: string }) {
    await this.name.fill(user.name);
    await this.email.fill(user.email);
    await this.password.fill(user.password);
    const response = this.page.waitForResponse('**/api/auth/register');
    await this.registerButton.click();
    return response;
  }

  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    const response = this.page.waitForResponse('**/api/auth/login');
    await this.loginButton.click();
    return response;
  }
}
