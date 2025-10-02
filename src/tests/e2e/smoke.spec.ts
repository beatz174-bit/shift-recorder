import { test, expect } from '@playwright/test';

const APP_TITLE = /Chrona/i;
const HOLIDAY_API_PATTERN = 'https://date.nager.at/api/v3/*';

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

test.describe('Chrona PWA UI', () => {
  test.beforeEach(async ({ page, context }) => {
    const storagePage = await context.newPage();
    await storagePage.goto('/');
    await storagePage.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('shift-recorder');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error('Failed to clear IndexedDB'));
        request.onblocked = () => resolve();
      });
      localStorage.clear();
      sessionStorage.clear();
    });
    await storagePage.close();

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
    await expect(dialog.locator('label').filter({ hasText: /^Finish time$/ })).toBeVisible();
    await expect(dialog.getByText('Finish times earlier than the start are saved on the following day.')).toBeVisible();
    await expect(dialog.getByText('Note')).toBeVisible();
    await expect(dialog.getByPlaceholder('Optional notes')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save shift' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('shifts page calendar controls are visible', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.getByRole('link', { name: 'Shifts' }).click();
    await expect(page).toHaveURL(/\/shifts$/);

    await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible();

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
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }

    await expect(page.getByText('Base rate (per hour)')).toBeVisible();
    await expect(page.getByText('Penalty rate (per hour)')).toBeVisible();
    await expect(page.getByLabel('Pay week starts on')).toBeVisible();
    const currencyLabel = page.locator('label').filter({ hasText: /^Currency$/ });
    await expect(currencyLabel).toBeVisible();

    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await expect(page.getByText('Shift reminders')).toBeVisible();
    await expect(page.getByText('Long-range (minutes)')).toBeVisible();
    await expect(page.getByText('Short-range (minutes)')).toBeVisible();
    await expect(page.getByText('Repeat every (minutes)')).toBeVisible();

    await page.getByRole('button', { name: 'Penalty rules', exact: true }).click();
    await expect(page.getByText('Penalty hours (daily window)')).toBeVisible();
    await expect(page.getByText('Enable a daily penalty window')).toBeVisible();
    await expect(page.getByText('Penalty applies all day on')).toBeVisible();
    await expect(page.locator('legend', { hasText: 'Public holidays' })).toBeVisible();
    await expect(page.getByText('Holiday region')).toBeVisible();
    const includeHolidaysCheckbox = page.getByRole('checkbox', {
      name: 'Include public holidays as all-day penalty shifts'
    });
    await includeHolidaysCheckbox.check();
    await expect(page.getByLabel('State or region')).toBeVisible();
    await expect(page.getByText('Holiday dates are sourced from')).toBeVisible();

    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    const themeLegend = page.locator('legend', { hasText: 'Theme' });
    await expect(themeLegend).toBeVisible();
    for (const label of ['System', 'Light', 'Dark']) {
      await expect(page.getByRole('radio', { name: label })).toBeVisible();
    }
    await expect(page.getByText('Time format', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Use 24-hour clock' })).toBeVisible();

    await page.getByRole('button', { name: 'Data & backup', exact: true }).click();
    const importTabButton = page.getByRole('button', { name: 'Import & export', exact: true });
    const backupTabButton = page.getByRole('button', { name: 'Backup & restore', exact: true });
    await expect(importTabButton).toBeVisible();
    await expect(backupTabButton).toBeVisible();
    const dataSectionHeading = page.getByRole('heading', { level: 3, name: 'Import & export shifts' });
    await expect(dataSectionHeading).toBeVisible();
    const dataSection = dataSectionHeading.locator('..');
    await expect(dataSection.getByText(/Download a CSV of your shifts/i)).toBeVisible();

    await backupTabButton.click();
    await expect(page.getByRole('heading', { level: 3, name: 'Backup & restore' })).toBeVisible();
    await expect(page.getByText(/Create a full Chrona backup/i)).toBeVisible();
  });

  test('user can manage shifts, settings, imports, exports, and backups', async ({ page }, testInfo) => {
    const addShiftButton = page.getByRole('button', { name: 'Add shift' });
    await addShiftButton.click();

    const createShiftDialog = page.getByRole('dialog', { name: 'Add a shift' });
    await expect(createShiftDialog).toBeVisible();

    const dateInput = createShiftDialog.locator('input[type="date"]');
    const timeInputs = createShiftDialog.locator('input[type="text"]');
    const noteInput = createShiftDialog.locator('textarea');

    const shiftDate = formatDateForInput(new Date());
    await dateInput.fill(shiftDate);
    await timeInputs.first().fill('9:00 AM');
    await timeInputs.nth(1).fill('5:30 PM');
    await noteInput.fill('Project kickoff');

    await createShiftDialog.getByRole('button', { name: 'Save shift' }).click();
    await expect(createShiftDialog).not.toBeVisible();

    const baseHoursCard = page.locator('div.rounded-xl', {
      has: page.getByText('Base hours', { exact: true })
    }).first();
    const penaltyHoursCard = page.locator('div.rounded-xl', {
      has: page.getByText('Penalty hours', { exact: true })
    }).first();
    const totalPayCard = page.locator('div.rounded-xl', {
      has: page.getByText('Total pay', { exact: true })
    }).first();

    await expect(page.getByText(/Chrona hasn't recorded any shifts for this week yet/i)).toBeHidden();
    await expect(baseHoursCard.locator('p').nth(1)).toHaveText('8.50');
    await expect(penaltyHoursCard.locator('p').nth(1)).toHaveText('0.00');
    await expect(totalPayCard.locator('p').nth(1)).toContainText('212.50');
    const summaryInsight = page.getByText(/Chrona has logged/i);
    await expect(summaryInsight).toContainText('8.50 hours this week so far');

    await page.getByRole('link', { name: 'Shifts' }).click();
    await expect(page).toHaveURL(/\/shifts$/);
    await expect(page.getByRole('button', { name: /Shift starting/i })).toBeVisible();

    await page.getByRole('link', { name: 'Summary' }).click();
    await expect(page).toHaveURL(/\/?$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);

    const generalForm = page.locator('form#settings-form');
    const numberInputs = generalForm.locator('input[type="number"]');
    await numberInputs.first().fill('40');
    await numberInputs.nth(1).fill('60');
    await generalForm.locator('#week-starts-on').selectOption('0');

    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    const appearanceForm = page.locator('form[data-tab="appearance"]');
    await appearanceForm.getByRole('checkbox', { name: 'Use 24-hour clock' }).check();

    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();

    await page.getByRole('link', { name: 'Summary' }).click();
    await expect(baseHoursCard.locator('p').nth(1)).toHaveText('8.50');
    await expect(totalPayCard.locator('p').nth(1)).toContainText('340.00');

    await addShiftButton.click();
    await expect(createShiftDialog).toBeVisible();
    await expect(createShiftDialog.locator('input[type="text"]').first()).toHaveAttribute(
      'placeholder',
      /14:30/
    );
    await createShiftDialog.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Data & backup', exact: true }).click();
    const importTab = page.getByRole('button', { name: 'Import & export', exact: true });
    const backupTab = page.getByRole('button', { name: 'Backup & restore', exact: true });
    await expect(importTab).toBeVisible();
    await expect(backupTab).toBeVisible();
    const dataSectionHeading = page.getByRole('heading', { level: 3, name: 'Import & export shifts' });
    await expect(dataSectionHeading).toBeVisible();
    const dataSection = dataSectionHeading.locator('..');
    await expect(dataSection.getByText(/Download a CSV of your shifts/i)).toBeVisible();

    const csvDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download all shifts (CSV)' }).click();
    const csvDownload = await csvDownloadPromise;
    let csvPath = await csvDownload.path();
    if (!csvPath) {
      csvPath = testInfo.outputPath(csvDownload.suggestedFilename() ?? 'shift-export.csv');
      await csvDownload.saveAs(csvPath);
    }
    await expect(page.getByText(/Exported 1 shift/i)).toBeVisible();
    expect(csvPath).toBeTruthy();

    const importInput = page.locator('input[type="file"][accept=".csv,text/csv"]');
    await importInput.setInputFiles({
      name: 'shifts-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`date,start,finish,notes\n${shiftDate},07:00,09:00,Imported shift\n`)
    });

    const importResultsSection = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: 'Import results' }) })
      .first();
    await expect(importResultsSection).toBeVisible();

    const importedStat = importResultsSection
      .locator('span')
      .filter({ hasText: /^Imported$/ })
      .first()
      .locator('..');
    const duplicateStat = importResultsSection
      .locator('span')
      .filter({ hasText: /^Duplicates$/ })
      .first()
      .locator('..');
    const overlapStat = importResultsSection
      .locator('span')
      .filter({ hasText: /^Overlapping$/ })
      .first()
      .locator('..');
    const failedStat = importResultsSection
      .locator('span')
      .filter({ hasText: /^Failed$/ })
      .first()
      .locator('..');

    await expect(importResultsSection.getByText('Imported successfully')).toBeVisible();
    await expect(importedStat.locator('span').nth(1)).toHaveText('1');
    await expect(duplicateStat.locator('span').nth(1)).toHaveText('0');
    await expect(overlapStat.locator('span').nth(1)).toHaveText('0');
    await expect(failedStat.locator('span').nth(1)).toHaveText('0');

    await page.getByRole('link', { name: 'Summary' }).click();
    await expect(baseHoursCard.locator('p').nth(1)).toHaveText('10.50');
    await expect(summaryInsight).toContainText('10.50 hours this week so far');
    await expect(totalPayCard.locator('p').nth(1)).toContainText('420.00');

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole('button', { name: 'Data & backup', exact: true }).click();
    const backupTabReturn = page.getByRole('button', { name: 'Backup & restore', exact: true });
    await expect(backupTabReturn).toBeVisible();

    await backupTabReturn.click();
    const settingsOnlyCheckbox = page.getByRole('checkbox', { name: 'Backup settings only' });
    if (!(await settingsOnlyCheckbox.isChecked())) {
      await settingsOnlyCheckbox.check();
    }

    const backupDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download backup' }).click();
    const backupDownload = await backupDownloadPromise;
    let backupPath = await backupDownload.path();
    if (!backupPath) {
      backupPath = testInfo.outputPath(backupDownload.suggestedFilename() ?? 'chrona-backup.tar.gz');
      await backupDownload.saveAs(backupPath);
    }
    await expect(page.getByText(/Backup saved as/i)).toBeVisible();
    expect(backupPath).toBeTruthy();

    const backupInput = page.locator('input[type="file"][accept=".tar.gz"]');
    await backupInput.setInputFiles(backupPath!);
    await expect(page.getByRole('button', { name: 'Choose another file' })).toBeVisible();

    await page.getByRole('button', { name: 'Restore backup' }).click();
    await expect(page.getByText('Backup restored successfully.')).toBeVisible();

    await page.getByRole('link', { name: 'Summary' }).click();
    await expect(summaryInsight).toContainText('0.00 hours this week so far');
    await expect(totalPayCard.locator('p').nth(1)).toContainText('0.00');
  });
});
