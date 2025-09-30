export function toLocalDateTimeInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nowLocalInputValue() {
  const now = new Date();
  now.setSeconds(0, 0);
  return toLocalDateTimeInput(now.toISOString());
}

export function toISO(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }
  return date.toISOString();
}
