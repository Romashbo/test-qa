import { test, expect } from '../fixtures';
import { CATEGORIES, PRODUCTS } from '../support/data';
import { money } from '../support/money';

test.describe('Каталог', () => {
  test('отображает все товары с ценой и наличием @smoke', async ({ catalog, api }) => {
    const products = await api.products();
    await catalog.open();

    await expect(catalog.cards).toHaveCount(products.length);
    const ethiopia = products.find((p) => p.id === PRODUCTS.ethiopia)!;
    const card = catalog.cardById(ethiopia.id);
    await expect(card.getByRole('link', { name: ethiopia.name })).toBeVisible();
    await expect(card.locator('.price')).toHaveText(money(ethiopia.price));
    await expect(card).toContainText(`В наличии: ${ethiopia.stock} шт.`);
  });

  test('товар без остатка нельзя положить в корзину', async ({ catalog }) => {
    await catalog.open();
    const card = catalog.cardById(PRODUCTS.decaf);
    await expect(card).toContainText('Нет в наличии');
    await expect(catalog.addButton(card)).toBeDisabled();
  });

  test.describe('Поиск', () => {
    test('по части названия без учёта регистра', async ({ catalog, api }) => {
      await catalog.open();
      await catalog.searchFor('КОФЕ');

      const expected = (await api.products()).filter(
        (p) => p.name.toLowerCase().includes('кофе') || p.description.toLowerCase().includes('кофе'),
      );
      expect(expected.length).toBeGreaterThan(1);
      await expect(catalog.cards).toHaveCount(expected.length);
      expect((await catalog.ids()).sort()).toEqual(expected.map((p) => p.id).sort());
    });

    test('по описанию товара', async ({ catalog }) => {
      await catalog.open();
      await catalog.searchFor('бергамот');
      await expect(catalog.cards).toHaveCount(1);
      await expect(catalog.cardById(PRODUCTS.ethiopia)).toBeVisible();
    });

    test('пробелы по краям запроса игнорируются', async ({ catalog }) => {
      await catalog.open();
      await catalog.searchFor('   матча   ');
      await expect(catalog.cards).toHaveCount(1);
      await expect(catalog.cards.first()).toContainText('Матча');
    });

    test('без результатов показывает пустое состояние', async ({ catalog }) => {
      await catalog.open();
      await catalog.searchFor('несуществующий-товар-xyz');
      await expect(catalog.cards).toHaveCount(0);
      await expect(catalog.empty).toHaveText(/Ничего не найдено/);
    });

    test('очистка запроса возвращает полный список', async ({ catalog, api }) => {
      const total = (await api.products()).length;
      await catalog.open();
      await catalog.searchFor('матча');
      await expect(catalog.cards).toHaveCount(1);
      await catalog.searchFor('');
      await expect(catalog.cards).toHaveCount(total);
    });
  });

  test.describe('Фильтр и сортировка', () => {
    for (const [id, label] of Object.entries(CATEGORIES)) {
      test(`фильтр по категории «${label}»`, async ({ catalog, api }) => {
        const expected = await api.products({ category: id });
        await catalog.open();
        await catalog.filterByCategory(label);
        await expect(catalog.cards).toHaveCount(expected.length);
        expect(await catalog.ids()).toEqual(expected.map((p) => p.id));
      });
    }

    test('категория и поиск работают вместе', async ({ catalog }) => {
      await catalog.open();
      await catalog.filterByCategory(CATEGORIES.gear);
      await catalog.searchFor('V60');
      // «Воронка V60» и «Фильтры V60» — аксессуары; «Подарочный набор» (с V60 в описании) — в «Подарках».
      expect((await catalog.names()).sort()).toEqual(['Воронка V60 керамическая', 'Фильтры бумажные V60, 100 шт']);
    });

    test('сортировка по возрастанию цены', async ({ catalog }) => {
      await catalog.open();
      await catalog.sortBy('Сначала дешёвые');
      const prices = await catalog.prices();
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });

    test('сортировка по убыванию цены', async ({ catalog }) => {
      await catalog.open();
      await catalog.sortBy('Сначала дорогие');
      const prices = await catalog.prices();
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
    });

    test('сортировка по названию', async ({ catalog }) => {
      await catalog.open();
      await catalog.sortBy('По названию');
      const names = await catalog.names();
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ru')));
    });

    test('сортировка сохраняется внутри выбранной категории', async ({ catalog }) => {
      await catalog.open();
      await catalog.filterByCategory(CATEGORIES.coffee);
      await catalog.sortBy('Сначала дорогие');
      const prices = await catalog.prices();
      expect(prices.length).toBe(3);
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
    });

    test('фильтры сохраняются при возврате в каталог', async ({ catalog, header }) => {
      await catalog.open();
      await catalog.filterByCategory(CATEGORIES.tea);
      await catalog.searchFor('чай');
      const before = await catalog.ids();

      await header.cartLink.click();
      await header.catalogLink.click();

      await expect(catalog.category).toHaveValue('tea');
      await expect(catalog.search).toHaveValue('чай');
      await expect(catalog.cards).toHaveCount(before.length);
    });
  });

  test.describe('Карточка товара', () => {
    test('открывается из каталога и совпадает с данными API', async ({ catalog, productPage, api, page }) => {
      const product = await api.product(PRODUCTS.assam);
      await catalog.open();
      await catalog.cardById(product.id).getByRole('link', { name: product.name }).click();

      await expect(page).toHaveURL(new RegExp(`#/product/${product.id}$`));
      await expect(productPage.title).toHaveText(product.name);
      await expect(productPage.price).toHaveText(money(product.price));
      await expect(productPage.root).toContainText(product.description);
      await expect(productPage.root).toContainText(CATEGORIES.tea);
      await expect(productPage.stock).toHaveText(`В наличии: ${product.stock} шт.`);

      await productPage.backLink.click();
      await expect(catalog.heading).toBeVisible();
    });

    test('несуществующий товар — понятное сообщение', async ({ page }) => {
      await page.goto('/#/product/999999');
      await expect(page.getByRole('heading', { name: 'Товар не найден' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Вернуться в каталог' })).toBeVisible();
    });

    test('неизвестный маршрут — страница 404', async ({ page }) => {
      await page.goto('/#/no-such-page');
      await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
    });
  });
});
