const pad = (value: number) => value.toString().padStart(2, '0');

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
