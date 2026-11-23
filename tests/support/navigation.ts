import { expect, type Page } from '@playwright/test';

/**
 * SPA на hash-роутинге: page.goto() на тот же самый hash не вызывает hashchange,
 * и страница не перерисовывается. В этом случае делаем reload.
 */
export async function openRoute(page: Page, route: string) {
  const current = page.url();
  if (current.startsWith('http') && new URL(current).hash === new URL(route, current).hash) {
    await page.reload();
  } else {
    await page.goto(route);
  }
}

/**
 * Ждёт перерисовки контейнера после действия.
 * Приложение рендерит через innerHTML уже ПОСЛЕ ответа API, поэтому ожидания ответа мало:
 * на медленной сети тест успевает прочитать старую разметку. Помечаем текущих потомков
 * контейнера и ждём, пока их не заменят новые.
 */
export async function expectRerender(page: Page, container: string, action: () => Promise<unknown>) {
  await page.locator(container).evaluate((el) => {
    for (const child of Array.from(el.children)) child.setAttribute('data-stale', '');
  });
  await action();
  await expect(page.locator(`${container} > [data-stale]`)).toHaveCount(0, { timeout: 10_000 });
}
