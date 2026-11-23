import type { Page } from '@playwright/test';

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
