import { test, expect } from '@playwright/test';

const APP_TITLE = /Shift Recorder/i;

test.describe('pwa smoke test', () => {
  test('app loads', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(APP_TITLE);
    await expect(page.getByRole('heading', { level: 1, name: APP_TITLE })).toBeVisible();
  });
});
