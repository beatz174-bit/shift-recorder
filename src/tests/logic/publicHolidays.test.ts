import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicHolidays, fetchPublicHolidayRegions } from '../../app/logic/publicHolidays';

function mockFetchResponse(data: unknown, ok = true) {
  return {
    ok,
    json: async () => data
  } as unknown as Response;
}

describe('public holiday utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('filters public holidays for a specific subdivision while keeping national holidays', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse([
        { date: '2024-01-01', counties: null },
        { date: '2024-03-01', counties: ['AU-NSW'] },
        { date: '2024-04-25', counties: ['AU-ACT'] },
        { date: '2024-06-01', counties: ['AU-NSW', 'AU-ACT'] }
      ])
    );
    vi.stubGlobal('fetch', fetchMock);

    const dates = await fetchPublicHolidays('AU', [2024], 'AU-NSW');
    expect(fetchMock).toHaveBeenCalledWith('https://date.nager.at/api/v3/PublicHolidays/2024/AU');
    expect(dates).toEqual(['2024-01-01', '2024-03-01', '2024-06-01']);
  });

  it('returns holidays for the whole country when subdivision is invalid', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockFetchResponse([
          { date: '2024-01-01', counties: null },
          { date: '2024-02-01', counties: ['AU-NSW'] }
        ])
      );
    vi.stubGlobal('fetch', fetchMock);

    const dates = await fetchPublicHolidays('AU', [2024], 'NSW');
    expect(dates).toEqual(['2024-01-01', '2024-02-01']);
  });

  it('loads and sorts holiday regions for a country', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({
        countryCode: 'AU',
        counties: [
          { code: 'AU-VIC', name: 'Victoria' },
          { code: 'AU-NSW', name: 'New South Wales' },
          { code: 'AU-NSW', name: 'Duplicate NSW' },
          { code: 'US-CA', name: 'California' }
        ]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const regions = await fetchPublicHolidayRegions('AU');
    expect(fetchMock).toHaveBeenCalledWith('https://date.nager.at/api/v3/CountryInfo/AU');
    expect(regions).toEqual([
      { code: 'AU-NSW', name: 'New South Wales' },
      { code: 'AU-VIC', name: 'Victoria' }
    ]);
  });
});
