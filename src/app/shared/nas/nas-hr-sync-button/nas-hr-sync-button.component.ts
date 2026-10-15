import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, switchMap, takeWhile, timer } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LocalDatePipe } from '../../pipes/local-date.pipe';

/** GET/POST …/hr-sync (backend D-088). */
interface HrSyncStatus {
  state: 'idle' | 'running' | 'done' | 'failed';
  /** Why it failed: HR not set up on the server, HR answered nothing, or an error. */
  reason?: 'not_configured' | 'no_data' | 'error' | null;
  started_at?: string;
  finished_at?: string;
  report?: { employees: number; created: number; updated: number };
  /** The last successful pull, automatic or from a button (D-108). */
  last_success_at?: string | null;
  /** HR is pulled automatically when the last success is this many hours old. */
  auto_every_hours?: number;
  /** No success for over a day: the scheduler is not running or HR keeps failing. */
  overdue?: boolean;
}

let nextId = 0;

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
  imports: [TranslateModule, LocalDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let hint = hintKey() | translate: { date: (info()?.last_success_at | localDate: 'dateTime'), hours: info()?.auto_every_hours ?? 24 };
    <button type="button" class="nas-hr-sync" [disabled]="running()" [attr.aria-busy]="running()" (click)="start()"
      [attr.title]="hintKey() ? hint : null" [attr.aria-describedby]="hintKey() ? hintId : null">
      <img class="nas-hr-sync__icon" [class.nas-hr-sync__icon--spin]="running()"
        src="assets/icons/figma/arrows-counter-clockwise-20.svg" width="20" height="20" alt="" />
      <span>{{ (running() ? 'hr_sync.running' : label()) | translate }}</span>
      @if (info()?.overdue) { <span class="nas-hr-sync__overdue" aria-hidden="true"></span> }
    </button>
    @if (hintKey()) { <span class="nas-hr-sync__hint" [id]="hintId">{{ hint }}</span> }
  `,
  styles: [`
    :host { display: inline-flex; }
    .nas-hr-sync {
      position: relative;
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
    .nas-hr-sync__overdue {
      position: absolute; inset-block-start: -4px; inset-inline-end: -4px;
      inline-size: 10px; block-size: 10px; border-radius: 50%;
      background: var(--nas-status-red-500); border: 2px solid #fcfcfc;
    }
    .nas-hr-sync__hint {
      position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden;
      clip-path: inset(50%); white-space: nowrap;
    }
    @keyframes nas-hr-sync-spin { to { transform: rotate(-360deg); } }
    @media (prefers-reduced-motion: reduce) { .nas-hr-sync__icon--spin { animation: none; } }
  `],
})
export class NasHrSyncButtonComponent implements OnInit {
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
  /** The last known status: when HR last updated us (button hint). */
  protected readonly info = signal<HrSyncStatus | null>(null);
  protected readonly hintId = `nas-hr-sync-hint-${++nextId}`;
  protected readonly hintKey = computed(() => {
    const s = this.info();
    if (!s || s.overdue === undefined) return '';
    if (!s.last_success_at) return 'hr_sync.hint_never';
    return s.overdue ? 'hr_sync.hint_overdue' : 'hr_sync.hint';
  });
  private poll?: Subscription;

  ngOnInit(): void {
    this.api.get<HrSyncStatus>(this.endpoint()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.info.set(res.result ?? null),
      // The hint is extra; the button works without it.
      error: () => this.info.set(null),
    });
  }

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
    if (status) this.info.set(status);
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
