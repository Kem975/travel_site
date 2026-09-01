/**
 * Human dates. The API speaks ISO ('2026-06-15'); nothing a visitor reads should.
 *
 * Dates are parsed by hand rather than handed to `new Date(iso)`: that constructor
 * reads a bare 'Y-m-d' as UTC midnight, which renders as the day before anywhere west
 * of Greenwich. These are calendar dates, not instants, so local midnight is right.
 */

const LONG: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
const MONTH: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
const DAY_MS = 86_400_000;

export function parseDate(iso: string | null | undefined): Date | null {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** '15 juin 2026' / 'June 15, 2026'. */
export function formatDate(iso: string | null | undefined, lang: string): string | null {
  const date = parseDate(iso);
  return date ? date.toLocaleDateString(lang, LONG) : null;
}

/**
 * '15–22 juin 2026', '28 juin – 3 juillet 2026'. Intl collapses the shared month and
 * year itself, and does it per locale — English moves the year to the end, which
 * hand-built concatenation gets wrong. Either bound may be missing; with only one,
 * that single date is the answer.
 */
export function formatDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
  lang: string,
): string | null {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return formatDate(from ?? to, lang);
  if (start.getTime() === end.getTime()) return formatDate(from, lang);
  return new Intl.DateTimeFormat(lang, LONG).formatRange(start, end);
}

/** 'juin 2026', from a 'YYYY-MM' or 'YYYY-MM-DD' key. */
export function formatMonth(key: string | null | undefined, lang: string): string | null {
  const date = parseDate(key?.length === 7 ? `${key}-01` : key);
  return date ? date.toLocaleDateString(lang, MONTH) : null;
}

/**
 * Whole calendar days from `from` to `to` — negative when `to` is earlier. Compared in
 * UTC so a daylight-saving shift in between cannot round the count off by one.
 */
export function daysBetween(from: Date, to: Date): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}
