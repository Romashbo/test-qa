import { expect, type Locator, type Page } from '@playwright/test';
import { openRoute } from '../support/navigation';

export class ProductPage {
  readonly root: Locator;
  readonly title: Locator;
  readonly price: Locator;
  readonly stock: Locator;
  readonly qty: Locator;
  readonly minus: Locator;
  readonly plus: Locator;
  readonly addButton: Locator;
  readonly backLink: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByTestId('product-page');
    this.title = this.root.getByRole('heading', { level: 1 });
    this.price = page.getByTestId('product-price');
    this.stock = this.root.locator('.in, .out');
    this.qty = this.root.getByRole('spinbutton', { name: 'Количество' });
    this.minus = this.root.getByRole('button', { name: 'Уменьшить количество' });
    this.plus = this.root.getByRole('button', { name: 'Увеличить количество' });
    this.addButton = this.root.getByRole('button', { name: 'Добавить в корзину' });
    this.backLink = page.getByRole('link', { name: '← Каталог' });
  }

  async open(id: number) {
    await openRoute(this.page, `/#/product/${id}`);
    await expect(this.root).toBeVisible();
  }

  async add(qty?: number) {
    if (qty !== undefined) await this.qty.fill(String(qty));
    await this.addButton.click();
  }
}
