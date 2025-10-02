import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS, type Settings } from '../../app/db/schema';
import type { HolidayRegion } from '../../app/logic/publicHolidays';

const useSettingsMock = vi.fn();
const mockFetchPublicHolidayRegions = vi.fn<
  (country: string) => Promise<HolidayRegion[]>
>(async (_country) => []);
const mockFetchPublicHolidays = vi.fn<
  (country: string, years: number[], subdivision?: string) => Promise<string[]>
>(async (_country, _years, _subdivision) => []);

vi.mock('../../app/state/SettingsContext', () => ({
  useSettings: () => useSettingsMock()
}));

vi.mock('../../app/logic/publicHolidays', () => ({
  fetchPublicHolidayRegions: (country: string) => mockFetchPublicHolidayRegions(country),
  fetchPublicHolidays: (country: string, years: number[], subdivision?: string) =>
    mockFetchPublicHolidays(country, years, subdivision)
}));

let updateSettingsSpy: ReturnType<typeof vi.fn>;
let reloadSettingsSpy: ReturnType<typeof vi.fn>;
let loadedSettings: Settings;
let SettingsPageComponent: (typeof import('../../app/routes/SettingsPage'))['default'];

afterEach(() => {
  cleanup();
});

beforeAll(async () => {
  SettingsPageComponent = (await import('../../app/routes/SettingsPage')).default;
});

beforeEach(() => {
  vi.clearAllMocks();

  loadedSettings = {
    ...DEFAULT_SETTINGS,
    penaltyDailyStartMinute: 0,
    penaltyDailyEndMinute: 7 * 60,
    penaltyAllDayWeekdays: [0, 6],
    includePublicHolidays: false,
    publicHolidayDates: ['2024-01-01'],
    publicHolidaySubdivision: '',
    theme: 'system'
  };

  updateSettingsSpy = vi.fn().mockResolvedValue(undefined);
  reloadSettingsSpy = vi.fn().mockResolvedValue(undefined);

  useSettingsMock.mockImplementation(() => ({
    settings: loadedSettings,
    updateSettings: updateSettingsSpy,
    reloadSettings: reloadSettingsSpy,
    isLoading: false,
    error: null
  }));

  mockFetchPublicHolidayRegions.mockImplementation(async (country: string) => {
    if (country === 'NZ') {
      return [
        { code: 'NZ-AUK', name: 'Auckland' },
        { code: 'NZ-WGN', name: 'Wellington' }
      ];
    }

    return [
      { code: 'AU-NSW', name: 'New South Wales' },
      { code: 'AU-VIC', name: 'Victoria' }
    ];
  });

  mockFetchPublicHolidays.mockResolvedValue(['2025-01-01']);
});

describe('SettingsPage', () => {
  it('saves normalized settings values with the selected options', async () => {
    const user = userEvent.setup();
    render(<SettingsPageComponent />);

    await screen.findByRole('heading', { name: /settings/i });
    expect(useSettingsMock).toHaveBeenCalled();

    const [baseRateInput, penaltyRateInput] = screen.getAllByRole('spinbutton');
    await user.clear(baseRateInput);
    await user.type(baseRateInput, '30');

    await user.clear(penaltyRateInput);
    await user.type(penaltyRateInput, '40');

    const weekStartSelect = screen.getByLabelText(/Pay week starts on/i);
    await user.selectOptions(weekStartSelect, '0');

    const currencyInput = screen.getByDisplayValue(DEFAULT_SETTINGS.currency);
    await user.clear(currencyInput);
    await user.type(currencyInput, 'eur');
    expect(currencyInput).toHaveValue('EUR');

    await user.click(screen.getByRole('radio', { name: /Dark/ }));

    const [startTimeInput] = screen.getAllByLabelText(/Start time/i);
    fireEvent.change(startTimeInput, { target: { value: '02:30' } });

    const [endTimeInput] = screen.getAllByLabelText(/End time/i);
    fireEvent.change(endTimeInput, { target: { value: '06:15' } });

    await user.click(screen.getByLabelText('Sunday'));
    await user.click(screen.getByLabelText('Saturday'));
    await user.click(screen.getByLabelText('Monday'));
    await user.click(screen.getByLabelText('Wednesday'));
    expect(screen.getByLabelText('Sunday')).not.toBeChecked();
    expect(screen.getByLabelText('Saturday')).not.toBeChecked();
    expect(screen.getByLabelText('Monday')).toBeChecked();
    expect(screen.getByLabelText('Wednesday')).toBeChecked();

    const includeHolidaysToggle = screen.getByLabelText(/Include public holidays/i);
    await user.click(includeHolidaysToggle);
    await waitFor(() => expect(includeHolidaysToggle).toBeChecked());

    const regionSelect = await screen.findByLabelText(/Holiday region/i);
    await waitFor(() => expect(regionSelect).not.toBeDisabled());
    await user.selectOptions(regionSelect, 'NZ');
    await waitFor(() => expect(regionSelect).toHaveValue('NZ'));

    await waitFor(() => expect(mockFetchPublicHolidayRegions).toHaveBeenCalledWith('NZ'));

    const subdivisionSelect = await screen.findByLabelText(/State or region/i);
    await waitFor(() => expect(subdivisionSelect).not.toBeDisabled());
    await user.selectOptions(subdivisionSelect, 'NZ-AUK');
    await waitFor(() => expect(subdivisionSelect).toHaveValue('NZ-AUK'));

    const saveButton = screen.getByRole('button', { name: /save settings/i });
    expect(saveButton).not.toBeDisabled();
    expect(saveButton).toHaveAttribute('form', 'settings-form');
    const form = document.getElementById('settings-form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(mockFetchPublicHolidays).toHaveBeenCalledTimes(1));
    const [country, years, subdivision] = mockFetchPublicHolidays.mock.calls[0];
    expect(country).toBe('NZ');
    expect(Array.isArray(years)).toBe(true);
    expect(subdivision).toBe('NZ-AUK');
    expect(mockFetchPublicHolidays).toHaveBeenCalledWith('NZ', expect.any(Array), 'NZ-AUK');

    await waitFor(() => expect(updateSettingsSpy).toHaveBeenCalledTimes(1));
    const payload = updateSettingsSpy.mock.calls[0][0];
    expect(payload).toEqual({
      baseRate: 3000,
      penaltyRate: 4000,
      weekStartsOn: 0,
      currency: 'EUR',
      theme: 'dark',
      use24HourTime: false,
      notificationLongLeadMinutes: 6 * 60,
      notificationShortLeadMinutes: 2 * 60,
      notificationRepeatMinutes: 15,
      penaltyDailyWindowEnabled: true,
      penaltyDailyStartMinute: 150,
      penaltyDailyEndMinute: 375,
      penaltyAllDayWeekdays: [1, 3],
      includePublicHolidays: true,
      publicHolidayCountry: 'NZ',
      publicHolidaySubdivision: 'NZ-AUK',
      publicHolidayDates: ['2025-01-01']
    });
  });

  it('prevents saving when the penalty window end precedes the start', async () => {
    render(<SettingsPageComponent />);

    await screen.findByRole('heading', { name: /settings/i });
    expect(useSettingsMock).toHaveBeenCalled();

    const [startTimeInput] = screen.getAllByLabelText(/Start time/i);
    const [endTimeInput] = screen.getAllByLabelText(/End time/i);

    fireEvent.change(startTimeInput, { target: { value: '10:00' } });
    fireEvent.change(endTimeInput, { target: { value: '09:00' } });

    const saveButton = screen.getByRole('button', { name: /save settings/i });
    expect(saveButton).toHaveAttribute('form', 'settings-form');
    const form = document.getElementById('settings-form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await screen.findByText('Penalty end time must be after the start time.');

    expect(updateSettingsSpy).not.toHaveBeenCalled();
    expect(mockFetchPublicHolidays).not.toHaveBeenCalled();
  });
});
