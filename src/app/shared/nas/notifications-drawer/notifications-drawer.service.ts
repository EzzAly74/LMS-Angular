import { Injectable, signal } from '@angular/core';

/**
 * Global signal-backed switch that controls the right-edge notifications
 * `<p-sidebar>`. Mounted once inside the admin layout, and toggled from
 * anywhere via `inject(NotificationsDrawerService).open()`.
 *
 * Keeping the state outside the drawer component itself means callers
 * never have to thread `@ViewChild` refs through deeply-nested templates —
 * the dashboard's "View All" link, a future header bell button, etc. all
 * share the same toggle without coordination.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsDrawerService {
  private readonly _open = signal(false);

  /** Read-only signal — true while the drawer is visible. */
  readonly isOpen = this._open.asReadonly();

  open(): void {
    this._open.set(true);
  }

  close(): void {
    this._open.set(false);
  }

  toggle(): void {
    this._open.update(v => !v);
  }
}
