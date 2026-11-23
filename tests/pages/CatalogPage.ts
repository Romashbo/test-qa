import { expect, type Locator, type Page } from '@playwright/test';
import { openRoute } from '../support/navigation';
import { parseMoney } from '../support/money';

export class CatalogPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly category: Locator;
  readonly sort: Locator;
  readonly list: Locator;
  readonly cards: Locator;
  readonly empty: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Каталог' });
    this.search = page.getByRole('searchbox', { name: 'Поиск' });
    this.category = page.getByRole('combobox', { name: 'Категория' });
    this.sort = page.getByRole('combobox', { name: 'Сортировка' });
    this.list = page.locator('#products');
    this.cards = page.getByTestId('product-card');
    this.empty = page.getByTestId('empty-list');
  }

  async open() {
    await openRoute(this.page, '/#/');
    await expect(this.heading).toBeVisible();
    await expect(this.cards.first().or(this.empty)).toBeVisible();
  }

  card(name: string | RegExp): Locator {
    return this.cards.filter({ has: this.page.getByRole('link', { name, exact: typeof name === 'string' }) });
  }

  cardById(id: number): Locator {
    return this.page.locator(`[data-testid="product-card"][data-id="${id}"]`);
  }

  addButton(card: Locator): Locator {
    return card.getByRole('button', { name: 'В корзину' });
  }

  /**
   * Фильтры применяются с debounce 250 мс — ждём именно ответ API на запрос с нужными
   * параметрами, а не фиксированный таймаут.
   */
  private async waitForList(action: () => Promise<unknown>) {
    const response = this.page.waitForResponse((r) => r.url().includes('/api/products') && r.request().method() === 'GET');
    await action();
    await response;
  }

  async searchFor(text: string) {
    await this.waitForList(() => this.search.fill(text));
  }

  async filterByCategory(label: string) {
    await this.waitForList(() => this.category.selectOption({ label }));
  }

  async sortBy(label: 'По умолчанию' | 'Сначала дешёвые' | 'Сначала дорогие' | 'По названию') {
    await this.waitForList(() => this.sort.selectOption({ label }));
  }

  async names(): Promise<string[]> {
    return this.cards.locator('.card__name').allInnerTexts();
  }

  async prices(): Promise<number[]> {
    return (await this.cards.locator('.price').allInnerTexts()).map(parseMoney);
  }

  async ids(): Promise<number[]> {
    return (await this.cards.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id))).map(Number);
  }
}
