import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, switchMap, takeWhile, timer } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

/** GET/POST …/hr-sync (backend D-088). */
interface HrSyncStatus {
  state: 'idle' | 'running' | 'done' | 'failed';
  /** Why it failed: HR not set up on the server, HR answered nothing, or an error. */
  reason?: 'not_configured' | 'no_data' | 'error' | null;
  started_at?: string;
  finished_at?: string;
  report?: { employees: number; created: number; updated: number };
}

/** How often the page asks whether the pull has finished, and for how long at most. */
const POLL_MS = 4000;
const MAX_POLLS = 225; // 15 minutes, the server's own limit

/**
 * "Update Learners" / "Update Job titles" (Figma 2746:88329, 2746:88341,
 * NEW2B-6184, D-088): pulls new employees, job titles and photos from HR now.
 * The server runs the pull after answering; the button shows "Updating…"
 * until the status says it finished, then tells the page to reload.
 */
@Component({
  selector: 'nas-hr-sync-button',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="nas-hr-sync" [disabled]="running()" [attr.aria-busy]="running()" (click)="start()">
      <img class="nas-hr-sync__icon" [class.nas-hr-sync__icon--spin]="running()"
        src="assets/icons/figma/arrows-counter-clockwise-20.svg" width="20" height="20" alt="" />
      <span>{{ (running() ? 'hr_sync.running' : label()) | translate }}</span>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .nas-hr-sync {
      display: inline-flex; align-items: center; gap: var(--nas-space-2);
      block-size: 36px; padding: var(--nas-space-2) var(--nas-space-3);
      border: 1px solid var(--nas-teal-1000); border-radius: var(--nas-radius-md);
      background: #fcfcfc; color: var(--nas-teal-1000);
      font: inherit; font-size: var(--nas-size-xs); font-weight: var(--nas-weight-medium);
      white-space: nowrap; cursor: pointer;
    }
    .nas-hr-sync:hover:not(:disabled) { background: var(--nas-neutral-100); }
    .nas-hr-sync:focus-visible { outline: 2px solid var(--nas-teal-700); outline-offset: 2px; }
    .nas-hr-sync:disabled { cursor: progress; opacity: .7; }
    .nas-hr-sync__icon--spin { animation: nas-hr-sync-spin 1s linear infinite; }
    @keyframes nas-hr-sync-spin { to { transform: rotate(-360deg); } }
    @media (prefers-reduced-motion: reduce) { .nas-hr-sync__icon--spin { animation: none; } }
  `],
})
export class NasHrSyncButtonComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** The page's hr-sync endpoint (API.ADMIN_LEARNERS + '/hr-sync', …). */
  readonly endpoint = input.required<string>();
  /** i18n key of the idle label ("Update Learners" / "Update Job titles"). */
  readonly label = input.required<string>();
  /** The pull finished: the page reloads its list. */
  readonly done = output<void>();

  protected readonly running = signal(false);
  private poll?: Subscription;

  start(): void {
    if (this.running()) return;
    this.running.set(true);
    this.api.post<HrSyncStatus>(this.endpoint(), {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => (res.result?.state === 'running' ? this.watch() : this.finish(res.result)),
      error: () => this.running.set(false),
    });
  }

  private watch(): void {
    this.poll?.unsubscribe();
    let polls = 0;
    this.poll = timer(POLL_MS, POLL_MS).pipe(
      switchMap(() => this.api.get<HrSyncStatus>(this.endpoint())),
      takeWhile(res => res.result?.state === 'running' && ++polls < MAX_POLLS, true),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: res => { if (res.result?.state !== 'running') this.finish(res.result); },
      error: () => this.running.set(false),
      complete: () => { if (this.running()) this.running.set(false); },
    });
  }

  private finish(status: HrSyncStatus | null | undefined): void {
    this.running.set(false);
    if (status?.state === 'done' && status.report) {
      this.toast.success(this.t.instant('hr_sync.done', {
        employees: status.report.employees, created: status.report.created, updated: status.report.updated,
      }));
      this.done.emit();
    } else {
      this.toast.error(this.t.instant(status?.reason === 'not_configured' ? 'hr_sync.not_configured'
        : status?.reason === 'no_data' ? 'hr_sync.no_data' : 'hr_sync.failed'));
    }
  }
}
