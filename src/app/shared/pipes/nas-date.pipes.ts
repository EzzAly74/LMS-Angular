import { Pipe, PipeTransform } from '@angular/core';

/**
 * Locale-aware dates without registering Angular locale data (D-051).
 *
 * Both pipes take the UI locale as an argument, so they stay pure and still
 * re-render when the language changes: `{{ d | nasDate: locale() }}`.
 * The Intl locales match admin-dashboard's existing formatting.
 */
function intlLocale(locale: string): string {
  return locale === 'ar' ? 'ar-EG' : 'en-GB';
}

function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 Jan 2025" / "١٢ يناير ٢٠٢٥". Empty input renders as an empty string. */
@Pipe({ name: 'nasDate', standalone: true })
export class NasDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, locale: string): string {
    const d = parse(value);
    return d
      ? new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
      : '';
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * "2 hours ago", "Yesterday", "3 days ago" (Figma 1986:74701) - and their
 * Arabic forms, which Intl pluralises correctly ("قبل ساعتين").
 * `now` is a parameter only so the value is testable; callers omit it.
 */
@Pipe({ name: 'nasRelativeTime', standalone: true })
export class NasRelativeTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, locale: string, now: Date = new Date()): string {
    const d = parse(value);
    if (!d) return '';

    const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
    const fmt = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });

    for (const [unit, size] of UNITS) {
      if (Math.abs(seconds) >= size) {
        return capitalise(fmt.format(Math.trunc(seconds / size), unit));
      }
    }
    return capitalise(fmt.format(0, 'minute'));
  }
}

/** Intl writes "yesterday"; the design writes "Yesterday". Arabic has no case. */
function capitalise(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
