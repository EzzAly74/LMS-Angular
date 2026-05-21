import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LocaleService } from '../services/locale.service';

/**
 * Re-runs `reload` whenever the user switches UI language.
 *
 * Must be called from an injection context (component constructor / field
 * initializer / `inject()` factory). The subscription auto-disposes when the
 * caller is destroyed via Angular's `DestroyRef`.
 *
 * @example
 *   class FooListComponent {
 *     constructor() { withLocaleReload(() => this.load()); }
 *   }
 */
export function withLocaleReload(reload: () => void): void {
  const locale = inject(LocaleService);
  const destroyRef = inject(DestroyRef);
  locale.changes$
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(() => reload());
}
