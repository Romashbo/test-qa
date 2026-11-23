import { expect, type Locator, type Page } from '@playwright/test';
import { openRoute } from '../support/navigation';
import { readMoney } from '../support/money';

export class CartPage {
  readonly heading: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly empty: Locator;
  readonly promoInput: Locator;
  readonly promoApply: Locator;
  readonly subtotal: Locator;
  readonly discount: Locator;
  readonly total: Locator;
  readonly checkoutLink: Locator;
  readonly clearButton: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Корзина' });
    this.table = page.getByTestId('cart-table');
    this.rows = page.getByTestId('cart-row');
    this.empty = page.getByTestId('cart-empty');
    this.promoInput = page.getByRole('textbox', { name: 'Промокод' });
    this.promoApply = page.getByRole('button', { name: 'Применить' });
    this.subtotal = page.getByTestId('subtotal');
    this.discount = page.getByTestId('discount');
    this.total = page.getByTestId('total');
    this.checkoutLink = page.getByRole('link', { name: 'Оформить заказ' });
    this.clearButton = page.getByRole('button', { name: 'Очистить корзину' });
  }

  async open() {
    await openRoute(this.page, '/#/cart');
    await expect(this.heading).toBeVisible();
    await expect(this.table.or(this.empty)).toBeVisible();
  }

  row(productId: number): Locator {
    return this.page.locator(`[data-testid="cart-row"][data-id="${productId}"]`);
  }

  qtyInput(productId: number): Locator {
    return this.row(productId).getByRole('spinbutton', { name: 'Количество' });
  }

  /** Каждое действие в корзине перерисовывает страницу после ответа API — ждём его. */
  private async mutate(action: () => Promise<unknown>) {
    const done = this.page.waitForResponse(
      (r) => r.url().includes('/api/cart') && r.request().method() !== 'GET',
    );
    await action();
    await done;
    await expect(this.table.or(this.empty)).toBeVisible();
  }

  async increase(productId: number) {
    await this.mutate(() => this.row(productId).getByRole('button', { name: 'Увеличить количество' }).click());
  }

  async decrease(productId: number) {
    await this.mutate(() => this.row(productId).getByRole('button', { name: 'Уменьшить количество' }).click());
  }

  async setQty(productId: number, qty: number) {
    await this.mutate(async () => {
      await this.qtyInput(productId).fill(String(qty));
      await this.qtyInput(productId).blur();
    });
  }

  async remove(productId: number) {
    await this.mutate(() => this.row(productId).getByRole('button', { name: 'Удалить' }).click());
  }

  async clear() {
    await this.mutate(() => this.clearButton.click());
  }

  async applyPromo(code: string) {
    await this.promoInput.fill(code);
    await this.mutate(() => this.promoApply.click());
  }

  async rowSum(productId: number): Promise<number> {
    return readMoney(this.row(productId).locator('td.num').nth(1));
  }

  async totals() {
    return {
      subtotal: await readMoney(this.subtotal),
      discount: (await this.discount.count()) ? await readMoney(this.discount) : 0,
      total: await readMoney(this.total),
    };
  }
}
