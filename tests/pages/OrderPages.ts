import { expect, type Locator, type Page } from '@playwright/test';
import { openRoute } from '../support/navigation';
import { readMoney } from '../support/money';

export class OrderPage {
  readonly success: Locator;
  readonly orderId: Locator;
  readonly items: Locator;
  readonly total: Locator;
  readonly shipping: Locator;
  readonly discount: Locator;
  readonly details: Locator;
  readonly notFound: Locator;

  constructor(readonly page: Page) {
    this.success = page.getByTestId('order-success');
    this.orderId = page.getByTestId('order-id');
    this.items = page.locator('#app table tbody tr');
    this.total = page.getByTestId('total');
    this.shipping = page.getByTestId('shipping');
    this.discount = page.getByTestId('discount');
    this.details = page.locator('#app p.muted');
    this.notFound = page.getByRole('heading', { name: 'Заказ не найден' });
  }

  async open(id: number) {
    await openRoute(this.page, `/#/order/${id}`);
    await expect(this.success.or(this.notFound)).toBeVisible();
  }

  async id(): Promise<number> {
    return Number(await this.orderId.innerText());
  }

  async totalValue(): Promise<number> {
    return readMoney(this.total);
  }
}

export class OrdersListPage {
  readonly heading: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly empty: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Мои заказы' });
    this.table = page.getByTestId('orders-table');
    this.rows = page.getByTestId('order-row');
    this.empty = page.getByText('У вас пока нет заказов');
  }

  async open() {
    await openRoute(this.page, '/#/orders');
  }

  row(orderId: number): Locator {
    return this.rows.filter({ has: this.page.getByRole('link', { name: `№${orderId}`, exact: true }) });
  }
}
