import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';

/**
 * Where an admin lands when their roles grant no `view-*` permission (DB-24).
 *
 * `fallbackRoute()` used to send them to /auth/login, whose guest guard sends
 * a signed-in admin back to /admin/dashboard, whose permission guard sends
 * them to login again: an endless redirect that froze the tab. This route is
 * un-gated, so the loop cannot form, and it says what happened instead of
 * showing a blank page.
 */
@Component({
  selector: 'app-no-access',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nas-page-container">
    <section class="na" aria-labelledby="na-title">
      <h1 class="na__title" id="na-title">{{ 'no_access.title' | translate }}</h1>
      <p class="na__text">{{ 'no_access.message' | translate }}</p>
      <button type="button" class="na__btn" (click)="auth.logout()">{{ 'auth.logout' | translate }}</button>
    </section>
    </div>
  `,
  styles: `
    .na {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--nas-space-4);
      inline-size: 100%;
      max-inline-size: 560px;
      margin-inline: auto;
      padding: var(--nas-space-6);
      border: 1px solid var(--nas-color-border);
      border-radius: var(--nas-radius-lg);
      background: var(--nas-color-bg-surface);
    }
    .na__title { margin: 0; font-size: var(--nas-size-l); font-weight: var(--nas-weight-semibold); color: var(--nas-color-text-strong); }
    .na__text { margin: 0; font-size: var(--nas-size-s); line-height: 1.6; color: var(--nas-color-text-muted); }
    .na__btn {
      min-block-size: 44px;
      padding-block: var(--nas-space-2);
      padding-inline: var(--nas-space-5);
      border: 0;
      border-radius: var(--nas-radius-md);
      background: var(--nas-teal-1000);
      color: var(--nas-neutral-100);
      font: inherit;
      font-weight: var(--nas-weight-semibold);
      cursor: pointer;
    }
    .na__btn:hover { background: var(--nas-teal-950); }
    .na__btn:focus-visible { outline: 2px solid var(--nas-teal-700); outline-offset: 2px; }
  `,
})
export class NoAccessComponent {
  protected readonly auth = inject(AuthService);
}
