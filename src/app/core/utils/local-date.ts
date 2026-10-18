/**
 * A filter's 'YYYY-MM-DD' value as a local Date for <nas-datepicker [ngModel]>.
 *
 * The SAME Date instance comes back for the same day. A template that bound a
 * fresh `new Date(...)` on every change-detection pass made ngModel see a new
 * value each time, write it to the picker, and start another pass: an endless
 * loop that froze the page as soon as a date filter was set (Reports, filter
 * dialogs). Equal input, identical output, so ngModel settles.
 */
const cache = new Map<string, Date>();
const LIMIT = 256;

export function localDateOf(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  let date = cache.get(value);
  if (!date) {
    if (cache.size >= LIMIT) cache.clear();
    date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    cache.set(value, date);
  }
  return date;
}
