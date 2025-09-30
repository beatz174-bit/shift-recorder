const API_BASE_URL = 'https://date.nager.at/api/v3';

type PublicHolidayResponse = {
  date: string;
  localName: string;
  name: string;
};

function sanitizeCountryCode(code: string): string {
  if (!code) {
    return '';
  }
  return code.trim().toUpperCase();
}

export async function fetchPublicHolidays(countryCode: string, years: number[]): Promise<string[]> {
  const normalizedCountry = sanitizeCountryCode(countryCode);
  if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
    throw new Error('Please provide a valid two-letter country code for public holidays.');
  }

  const uniqueYears = Array.from(new Set(years.filter((year) => Number.isFinite(year) && year >= 1900))).sort((a, b) => a - b);
  if (uniqueYears.length === 0) {
    const currentYear = new Date().getFullYear();
    uniqueYears.push(currentYear);
  }

  const holidayDates = new Set<string>();

  for (const year of uniqueYears) {
    const endpoint = `${API_BASE_URL}/PublicHolidays/${year}/${normalizedCountry}`;
    let response: Response;
    try {
      response = await fetch(endpoint);
    } catch (error) {
      throw new Error(`Unable to reach the public holidays service (${endpoint}).`);
    }

    if (!response.ok) {
      throw new Error(`Failed to load public holidays for ${normalizedCountry} (${year}).`);
    }

    const data = (await response.json()) as PublicHolidayResponse[];
    data.forEach((holiday) => {
      if (holiday?.date) {
        holidayDates.add(holiday.date);
      }
    });
  }

  return Array.from(holidayDates).sort();
}
