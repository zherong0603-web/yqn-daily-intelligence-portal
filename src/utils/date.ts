export function dateInTimeZone(timeZone: string, date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export function startOfUtcDay(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

export function hoursAgo(date: Date, now = new Date()): number {
  return (now.getTime() - date.getTime()) / 3_600_000;
}

export function parseDateMaybe(value: unknown, fallback = new Date()): Date {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export function isoWeek(dateString: string): { year: number; week: number } {
  const date = startOfUtcDay(dateString);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

export function monthParts(dateString: string): { year: string; month: string } {
  return { year: dateString.slice(0, 4), month: dateString.slice(5, 7) };
}

export function compareDateDesc(a: { date: string }, b: { date: string }): number {
  return b.date.localeCompare(a.date);
}

export function compareDateAsc(a: { date: string }, b: { date: string }): number {
  return a.date.localeCompare(b.date);
}
