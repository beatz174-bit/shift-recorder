const API_BASE_URL = 'https://date.nager.at/api/v3';

type PublicHolidayResponse = {
  date: string;
  localName: string;
  name: string;
  counties?: string[] | null;
};

type CountryInfoResponse = {
  countryCode: string;
  name: string;
  officialName?: string;
  counties?: { code: string; name: string; shortName?: string }[];
};

export type HolidayRegion = {
  code: string;
  name: string;
};

function sanitizeCountryCode(code: string): string {
  if (!code) {
    return '';
  }
  return code.trim().toUpperCase();
}

function sanitizeSubdivisionCode(subdivisionCode: string | undefined, countryCode: string): string {
  if (!subdivisionCode) {
    return '';
  }
  const normalized = subdivisionCode.trim().toUpperCase();
  if (!normalized) {
    return '';
  }
  if (!normalized.startsWith(`${countryCode}-`)) {
    return '';
  }
  if (!/^[A-Z]{2}-[A-Z0-9]{1,10}$/.test(normalized)) {
    return '';
  }
  return normalized;
}

function normalizeCountyCode(value: string): string {
  return value.trim().toUpperCase();
}

export async function fetchPublicHolidayRegions(countryCode: string): Promise<HolidayRegion[]> {
  const normalizedCountry = sanitizeCountryCode(countryCode);
  if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
    throw new Error('Please provide a valid two-letter country code for public holidays.');
  }

  const endpoint = `${API_BASE_URL}/CountryInfo/${normalizedCountry}`;

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch {
    throw new Error(`Unable to reach the public holidays service (${endpoint}).`);
  }

  if (!response.ok) {
    throw new Error(`Failed to load regions for ${normalizedCountry}.`);
  }

  const data = (await response.json()) as CountryInfoResponse;
  const counties = Array.isArray(data?.counties) ? data.counties : [];
  const regions: HolidayRegion[] = counties
    .map((county) => {
      if (!county?.code || !county?.name) {
        return null;
      }
      const code = county.code.trim().toUpperCase();
      if (!code.startsWith(`${normalizedCountry}-`)) {
        return null;
      }
      return {
        code,
        name: county.name.trim()
      } satisfies HolidayRegion;
    })
    .filter((region): region is HolidayRegion => Boolean(region));

  const unique = new Map<string, HolidayRegion>();
  regions.forEach((region) => {
    if (!unique.has(region.code)) {
      unique.set(region.code, region);
    }
  });

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchPublicHolidays(
  countryCode: string,
  years: number[],
  subdivisionCode?: string
): Promise<string[]> {
  const normalizedCountry = sanitizeCountryCode(countryCode);
  if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
    throw new Error('Please provide a valid two-letter country code for public holidays.');
  }

  const normalizedSubdivision = sanitizeSubdivisionCode(subdivisionCode, normalizedCountry);

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
    } catch {
      throw new Error(`Unable to reach the public holidays service (${endpoint}).`);
    }

    if (!response.ok) {
      throw new Error(`Failed to load public holidays for ${normalizedCountry} (${year}).`);
    }

    const data = (await response.json()) as PublicHolidayResponse[];
    data.forEach((holiday) => {
      if (!holiday?.date) {
        return;
      }

      if (!normalizedSubdivision) {
        if (holiday.counties == null) {
          holidayDates.add(holiday.date);
        }
        return;
      }

      const counties = Array.isArray(holiday.counties) ? holiday.counties.map(normalizeCountyCode) : [];
      if (counties.length === 0 || counties.includes(normalizedSubdivision)) {
        holidayDates.add(holiday.date);
      }
    });
  }

  return Array.from(holidayDates).sort();
}
