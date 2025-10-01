const pad = (value: number) => value.toString().padStart(2, '0');

const TIME_24_HOUR_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const TIME_12_HOUR_PATTERN = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*([AaPp][Mm])$/;

const TWENTY_FOUR_HOUR_LABEL = 'HH:MM (24-hour)';
const TWELVE_HOUR_LABEL = 'HH:MM AM/PM (12-hour)';

function to12HourLabel(hours: number) {
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 || 12;
  return { suffix, hours: normalizedHours };
}

function ensureValid(date: Date) {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }
  return date;
}

export function toLocalDateTimeInput(iso: string) {
  const date = ensureValid(new Date(iso));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toLocalDateInput(iso: string) {
  const date = ensureValid(new Date(iso));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toLocalTimeInput(iso: string) {
  const date = ensureValid(new Date(iso));
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTimeForInput(iso: string, use24HourTime: boolean) {
  const normalized = toLocalTimeInput(iso);
  return use24HourTime ? normalized : formatNormalizedTime(normalized, false);
}

export function nowLocalInputValue() {
  const now = new Date();
  now.setSeconds(0, 0);
  return toLocalDateTimeInput(now.toISOString());
}

export function nowLocalDateInputValue() {
  const now = new Date();
  now.setSeconds(0, 0);
  return toLocalDateInput(now.toISOString());
}

export function nowLocalTimeInputValue() {
  const now = new Date();
  now.setSeconds(0, 0);
  return toLocalTimeInput(now.toISOString());
}

export function nowTimeInputForMode(use24HourTime: boolean) {
  const normalized = nowLocalTimeInputValue();
  return use24HourTime ? normalized : formatNormalizedTime(normalized, false);
}

export function toISO(value: string) {
  const date = ensureValid(new Date(value));
  return date.toISOString();
}

export function createDateFromLocalInputs(date: string, time: string) {
  const combined = `${date}T${time}`;
  const parsed = ensureValid(new Date(combined));
  parsed.setSeconds(0, 0);
  return parsed;
}

export function formatNormalizedTime(time: string, use24HourTime: boolean) {
  if (!TIME_24_HOUR_PATTERN.test(time)) {
    throw new Error('Time must use HH:MM format');
  }

  if (use24HourTime) {
    return time;
  }

  const [, hoursPart, minutesPart] = time.match(TIME_24_HOUR_PATTERN)!;
  const hours = Number.parseInt(hoursPart, 10);
  const { suffix, hours: displayHours } = to12HourLabel(hours);
  return `${pad(displayHours)}:${minutesPart} ${suffix}`;
}

function parse24HourTime(value: string) {
  const match = value.match(TIME_24_HOUR_PATTERN);
  if (!match) {
    throw new Error(`Use ${TWENTY_FOUR_HOUR_LABEL}.`);
  }
  const [, hours, minutes] = match;
  return `${pad(Number.parseInt(hours, 10))}:${minutes}`;
}

function parse12HourTime(value: string) {
  const match = value.match(TIME_12_HOUR_PATTERN);
  if (!match) {
    throw new Error(`Use ${TWELVE_HOUR_LABEL}.`);
  }
  const [, hoursPart, minutesPart, suffixPart] = match;
  const hours = Number.parseInt(hoursPart, 10);
  const suffix = suffixPart.toLowerCase() as 'am' | 'pm';
  const normalizedHours = suffix === 'am' ? hours % 12 : (hours % 12) + 12;
  return `${pad(normalizedHours)}:${minutesPart}`;
}

export function parseTimeInput(value: string, use24HourTime: boolean) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Enter a time value.');
  }

  if (use24HourTime) {
    return parse24HourTime(trimmed);
  }

  try {
    return parse12HourTime(trimmed);
  } catch (error) {
    throw new Error((error as Error).message);
  }
}

export function tryNormalizeTimeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return parse24HourTime(trimmed);
  } catch (error24) {
    try {
      return parse12HourTime(trimmed);
    } catch (error12) {
      return null;
    }
  }
}
