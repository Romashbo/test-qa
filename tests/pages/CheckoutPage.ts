import { expect, type Locator, type Page } from '@playwright/test';
import { openRoute } from '../support/navigation';
import { readMoney } from '../support/money';

export interface RecipientForm {
  name?: string;
  phone?: string;
  delivery?: 'courier' | 'pickup';
  address?: string;
  payment?: 'card' | 'cash';
  comment?: string;
}

export class CheckoutPage {
  readonly heading: Locator;
  readonly form: Locator;
  readonly name: Locator;
  readonly phone: Locator;
  readonly courier: Locator;
  readonly pickup: Locator;
  readonly address: Locator;
  readonly card: Locator;
  readonly cash: Locator;
  readonly comment: Locator;
  readonly submit: Locator;
  readonly formError: Locator;
  readonly shipping: Locator;
  readonly total: Locator;
  readonly subtotal: Locator;
  readonly discount: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Оформление заказа' });
    this.form = page.locator('form#checkout');
    this.name = page.getByLabel('Имя получателя');
    this.phone = page.getByLabel('Телефон');
    this.courier = page.getByRole('radio', { name: 'Курьером' });
    this.pickup = page.getByRole('radio', { name: 'Самовывоз' });
    this.address = page.getByLabel('Адрес доставки');
    this.card = page.getByRole('radio', { name: 'Картой при получении' });
    this.cash = page.getByRole('radio', { name: 'Наличными' });
    this.comment = page.getByLabel('Комментарий к заказу');
    this.submit = page.getByRole('button', { name: 'Подтвердить заказ' });
    this.formError = this.form.getByRole('alert');
    this.shipping = page.getByTestId('shipping');
    this.total = page.getByTestId('total');
    this.subtotal = page.getByTestId('subtotal');
    this.discount = page.getByTestId('discount');
  }

  async open() {
    await openRoute(this.page, '/#/checkout');
    await expect(this.heading).toBeVisible();
    await expect(this.shipping).toBeVisible();
  }

  fieldError(field: string): Locator {
    return this.form.locator(`.field-error[data-field="${field}"]`);
  }

  async chooseDelivery(method: 'courier' | 'pickup') {
    const recalculated = this.page.waitForResponse((r) => r.url().includes(`/api/delivery?method=${method}`));
    await (method === 'courier' ? this.courier : this.pickup).check();
    await recalculated;
  }

  async fill(data: RecipientForm) {
    if (data.delivery) await this.chooseDelivery(data.delivery);
    if (data.name !== undefined) await this.name.fill(data.name);
    if (data.phone !== undefined) await this.phone.fill(data.phone);
    if (data.address !== undefined && (await this.address.isVisible())) await this.address.fill(data.address);
    if (data.payment) await (data.payment === 'card' ? this.card : this.cash).check();
    if (data.comment !== undefined) await this.comment.fill(data.comment);
  }

  async shippingCost(): Promise<number> {
    const text = await this.shipping.innerText();
    return text.trim() === 'бесплатно' ? 0 : readMoney(this.shipping);
  }

  /** Отправляет форму и ждёт ответ API. */
  async placeOrder() {
    const response = this.page.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
    await this.submit.click();
    return response;
  }
}
