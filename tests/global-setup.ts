import { request, type FullConfig } from '@playwright/test';

/**
 * Локальный прогон: сбрасываем данные магазина к исходным, чтобы остатки товаров
 * были предсказуемыми даже при reuseExistingServer.
 * Прогон против внешнего стенда (BASE_URL): только проверяем, что стенд жив.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const api = await request.newContext({ baseURL });
  try {
    const health = await api.get('/api/health');
    if (!health.ok()) throw new Error(`Магазин недоступен: ${baseURL} → ${health.status()}`);

    if (!process.env.BASE_URL) {
      const reset = await api.post('/api/test/reset');
      if (!reset.ok()) {
        throw new Error('POST /api/test/reset недоступен — запустите магазин с ALLOW_TEST_RESET=1');
      }
    }
  } finally {
    await api.dispose();
  }
}
