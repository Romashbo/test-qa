import type { Locator } from '@playwright/test';

/** «2 300 ₽», «−500 ₽» → 2300 / 500. Пробелы-разделители в ru-RU бывают неразрывными. */
export function parseMoney(text: string): number {
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) throw new Error(`Не удалось распознать сумму в «${text}»`);
  return Number(digits);
}

export async function readMoney(locator: Locator): Promise<number> {
  return parseMoney(await locator.innerText());
}

/** Регэксп для toHaveText: число в формате ru-RU с любым пробелом-разделителем. */
export function money(n: number): RegExp {
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00a0\\u202f]');
  return new RegExp(`^\\D*${grouped}\\s?₽$`);
}
