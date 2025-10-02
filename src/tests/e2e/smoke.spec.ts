import { test, expect } from '@playwright/test';

const APP_TITLE = /Chrona/i;
const HOLIDAY_API_PATTERN = 'https://date.nager.at/api/v3/*';

test.describe('Chrona PWA UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(HOLIDAY_API_PATTERN, async (route) => {
      const url = route.request().url();
      if (url.includes('/CountryInfo/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            counties: [
              { code: 'AU-NSW', name: 'New South Wales' },
              { code: 'AU-VIC', name: 'Victoria' }
            ]
          })
        });
        return;
      }

      if (url.includes('/PublicHolidays/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }

      await route.continue();
    });

    await page.goto('/');
    await expect(page).toHaveTitle(APP_TITLE);
    await expect(page.getByRole('heading', { level: 1, name: APP_TITLE })).toBeVisible();
  });

  test('summary page renders all primary sections', async ({ page }) => {
    const summaryLink = page.getByRole('link', { name: 'Summary' });
    const shiftsLink = page.getByRole('link', { name: 'Shifts' });
    const addShiftButton = page.getByRole('button', { name: 'Add shift' });
    const settingsLink = page.getByRole('link', { name: 'Settings' });

    await expect(summaryLink).toBeVisible();
    await expect(shiftsLink).toBeVisible();
    await expect(addShiftButton).toBeVisible();
    await expect(settingsLink).toBeVisible();
    await expect(addShiftButton).toBeEnabled();

    await expect(page.getByText(/Precision shift tracking for people who live by the clock/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Prev/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Next/i })).toBeVisible();
    await expect(page.getByText('Base hours')).toBeVisible();
    await expect(page.getByText('Penalty hours')).toBeVisible();
    await expect(page.getByText('Total pay')).toBeVisible();
    await expect(page.getByText(/Chrona has logged/i)).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Shifts' })).toBeVisible();
    await expect(page.getByText(/Chrona hasn't recorded any shifts for this week yet/i)).toBeVisible();
  });

  test('shift creation modal exposes full form', async ({ page }) => {
    const addShiftButton = page.getByRole('button', { name: 'Add shift' });
    await expect(addShiftButton).toBeEnabled();
    await addShiftButton.click();

    const dialog = page.getByRole('dialog', { name: 'Add a shift' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Date')).toBeVisible();
    await expect(dialog.getByText('Start time')).toBeVisible();
    await expect(dialog.getByText('Finish time')).toBeVisible();
    await expect(dialog.getByText('Finish times earlier than the start are saved on the following day.')).toBeVisible();
    await expect(dialog.getByText('Note')).toBeVisible();
    await expect(dialog.getByPlaceholder('Optional notes')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save shift' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('shifts page calendar controls are visible', async ({ page }) => {
    await page.getByRole('link', { name: 'Shifts' }).click();
    await expect(page).toHaveURL(/\/shifts$/);

    await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();

    for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    const dayButton = page.getByRole('button', { name: /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/ });
    await expect(dayButton.first()).toBeVisible();
    await expect(page.getByText(/Chrona hasn't logged any shifts yet/i)).toBeVisible();
  });

  test('settings page tabs reveal their content', async ({ page }) => {
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    const tabLabels = ['General', 'Notifications', 'Penalty rules', 'Appearance', 'Data & backup'];
    for (const label of tabLabels) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    await expect(page.getByText('Base rate (per hour)')).toBeVisible();
    await expect(page.getByText('Penalty rate (per hour)')).toBeVisible();
    await expect(page.getByLabel('Pay week starts on')).toBeVisible();
    await expect(page.getByText('Currency')).toBeVisible();

    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await expect(page.getByText('Shift reminders')).toBeVisible();
    await expect(page.getByText('Long-range (minutes)')).toBeVisible();
    await expect(page.getByText('Short-range (minutes)')).toBeVisible();
    await expect(page.getByText('Repeat every (minutes)')).toBeVisible();

    await page.getByRole('button', { name: 'Penalty rules', exact: true }).click();
    await expect(page.getByText('Penalty hours (daily window)')).toBeVisible();
    await expect(page.getByText('Enable a daily penalty window')).toBeVisible();
    await expect(page.getByText('Penalty applies all day on')).toBeVisible();
    await expect(page.getByText('Public holidays')).toBeVisible();
    await expect(page.getByText('Holiday region')).toBeVisible();
    await expect(page.getByText('State or region')).toBeVisible();
    await expect(page.getByText('Holiday dates are sourced from')).toBeVisible();

    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await expect(page.getByText('Theme')).toBeVisible();
    await expect(page.getByText('System')).toBeVisible();
    await expect(page.getByText('Light')).toBeVisible();
    await expect(page.getByText('Dark')).toBeVisible();
    await expect(page.getByText('Time format')).toBeVisible();
    await expect(page.getByText('Use 24-hour clock')).toBeVisible();

    await page.getByRole('button', { name: 'Data & backup', exact: true }).click();
    const dataSection = page.locator('div').filter({ hasText: 'Import & export shifts' });
    await expect(dataSection).toBeVisible();
    const dataTabs = dataSection.getByRole('button');
    await expect(dataTabs.filter({ hasText: 'Import & export' })).toBeVisible();
    await expect(dataTabs.filter({ hasText: 'Backup & restore' })).toBeVisible();
    await expect(dataSection.getByRole('heading', { level: 3, name: 'Import & export shifts' })).toBeVisible();
    await expect(dataSection.getByText(/Download a CSV of your shifts/i)).toBeVisible();

    await dataTabs.filter({ hasText: 'Backup & restore' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Backup & restore' })).toBeVisible();
    await expect(page.getByText(/Create a full Chrona backup/i)).toBeVisible();
  });
});
