import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from '../../core/services/locale.service';

/**
 * Dates and times in the interface language. Angular's DatePipe reads
 * LOCALE_ID once ("en"), so `| date` printed English month and day names in
 * the Arabic interface. This pipe takes the language from LocaleService,
 * follows a switch, and uses the same Intl locales as `nasDate` (D-051).
 *
 *   {{ row.created_at | localDate }}             14 Oct 2026 / ١٤ أكتوبر ٢٠٢٦
 *   {{ row.created_at | localDate: 'dateTime' }} 14 Oct 2026, 09:30
 *
 * Impure for the language switch; the last result is cached, so a check that
 * changes nothing costs a comparison.
 */
export type LocalDateStyle =
  | 'date'            // 14 Oct 2026
  | 'dateTime'        // 14 Oct 2026, 09:30
  | 'dateTimeSeconds' // 14 Oct 2026, 09:30:15
  | 'dayMonth'        // 14 Oct
  | 'long'            // 14 October 2026
  | 'full'            // Wednesday 14 October 2026
  | 'time';           // 09:30

const OPTIONS: Record<LocalDateStyle, Intl.DateTimeFormatOptions> = {
  date: { day: 'numeric', month: 'short', year: 'numeric' },
  dateTime: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  dateTimeSeconds: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' },
  dayMonth: { day: 'numeric', month: 'short' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, style: LocalDateStyle): Intl.DateTimeFormat {
  const intl = locale === 'ar' ? 'ar-EG' : 'en-GB';
  const key = `${intl}|${style}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(intl, OPTIONS[style]);
    formatters.set(key, f);
  }
  return f;
}

@Pipe({ name: 'localDate', standalone: true, pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService).locale;
  private last: { value: unknown; style: LocalDateStyle; locale: string; out: string } | null = null;

  transform(value: string | number | Date | null | undefined, style: LocalDateStyle = 'date'): string {
    if (value === null || value === undefined || value === '') return '';
    const locale = this.locale();
    const last = this.last;
    if (last && last.value === value && last.style === style && last.locale === locale) return last.out;

    const d = value instanceof Date ? value : new Date(value);
    const out = Number.isNaN(d.getTime()) ? '' : formatter(locale, style).format(d);
    this.last = { value, style, locale, out };
    return out;
  }
}
