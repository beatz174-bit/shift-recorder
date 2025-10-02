export function formatMinutesDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) {
    return '0h 0m';
  }

  const normalized = Math.max(0, Math.round(minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours}h ${mins}m`;
}
