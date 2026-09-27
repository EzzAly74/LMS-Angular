import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { Observable } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { NasConfirmModalComponent } from '../../../../shared/nas/nas-confirm-modal/nas-confirm-modal.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { ExternalTrainingRequest, RequestStats, ReviewOptions } from '../../models/external-training.model';
import { ExternalTrainingApiService } from '../../services/external-training-api.service';
import { EtStatsComponent } from '../../components/et-stats/et-stats.component';
import { RejectDialogComponent } from '../../components/reject-dialog/reject-dialog.component';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

type LoadState = 'loading' | 'ready' | 'error' | 'not-found';
type Confirm = 'approve' | 'reopen' | null;

/**
 * Review External Training Request - Figma 2181:116391 (D8), with the
 * "Rejection reason" modal (2209:90462).
 *
 * A pending request shows the learner's fields read-only, the optional
 * qualification to grant, the optional internal course to record it against
 * (Q-042; not drawn, FG-35), the certificate, and Reject / Approve. Approval
 * asks for confirmation first - it may grant a qualification. A decided
 * request is read-only with its outcome; a super admin may reopen it (D-057).
 */
@Component({
  selector: 'app-external-training-review',
  standalone: true,
  imports: [
    FormsModule, RouterLink, TranslateModule, DropdownModule, SkeletonModule,
    NasConfirmModalComponent, NasDatePipe, EtStatsComponent, RejectDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-review.component.html',
  styleUrl: './request-review.component.scss',
})
export class ExternalTrainingReviewComponent {
  private readonly api        = inject(ExternalTrainingApiService);
  private readonly toast      = inject(MessageService);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth     = inject(AuthService);
  protected readonly locale   = inject(LocaleService);

  /** Route param (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly state    = signal<LoadState>('loading');
  protected readonly request  = signal<ExternalTrainingRequest | null>(null);
  protected readonly stats    = signal<RequestStats | null>(null);
  protected readonly options  = signal<ReviewOptions>({ qualifications: [], courses: [] });
  protected readonly qualificationId = signal<number | null>(null);
  protected readonly courseId = signal<number | null>(null);
  protected readonly busy     = signal(false);
  protected readonly confirm  = signal<Confirm>(null);
  protected readonly rejectOpen  = signal(false);
  protected readonly rejectError = signal<string | null>(null);

  protected readonly pending = computed(() => this.request()?.status === 'pending');
  protected readonly format = computed(() => {
    const r = this.request();
    if (!r) return '';
    const ext = r.certificate.name.split('.').pop() ?? '';
    return (ext || r.certificate.mime.split('/').pop() || '').toUpperCase().slice(0, 4);
  });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.load(id));
    }, { allowSignalWrites: true });
    // A language switch re-reads the names (qualification, course, pickers) in
    // the new language, keeping whatever the reviewer has already picked.
    withLocaleReload(() => this.refreshForLocale());
  }

  private refreshForLocale(): void {
    const id = Number(this.id());
    if (this.state() !== 'ready' || !Number.isInteger(id) || id < 1) return;
    this.api.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: r => this.request.set(r), error: () => undefined });
    this.loadStats();
    this.api.options().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: o => this.options.set(o), error: () => undefined });
  }

  protected load(id = Number(this.id())): void {
    if (!Number.isInteger(id) || id < 1) {
      this.state.set('not-found');
      return;
    }
    this.state.set('loading');
    this.api.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        this.show(r);
        this.state.set('ready');
      },
      error: (e: unknown) => this.state.set(e instanceof HttpErrorResponse && e.status === 404 ? 'not-found' : 'error'),
    });
    this.loadStats();
    this.api.options().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: o => this.options.set(o), error: () => undefined });
  }

  protected size(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  protected download(): void {
    const r = this.request();
    if (!r) return;
    this.api.certificate(r).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => this.fail() });
  }

  protected approve(): void {
    const r = this.request();
    if (!r) return;
    this.decide(this.api.approve(r.id, this.qualificationId(), this.courseId()), 'external_training.review.approved');
  }

  protected reject(reason: string): void {
    const r = this.request();
    if (!r) return;
    this.rejectError.set(null);
    this.decide(this.api.reject(r.id, reason), 'external_training.review.rejected', true);
  }

  protected reopen(): void {
    const r = this.request();
    if (!r) return;
    this.decide(this.api.reopen(r.id), 'external_training.review.reopened');
  }

  private decide(call: Observable<ExternalTrainingRequest>, doneKey: string, fromDialog = false): void {
    this.busy.set(true);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        this.busy.set(false);
        this.confirm.set(null);
        this.rejectOpen.set(false);
        this.show(r);
        this.loadStats();
        this.toast.add({ severity: 'success', summary: this.t.instant('common.success_title'), detail: this.t.instant(doneKey) });
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.confirm.set(null);
        const first = e instanceof HttpErrorResponse
          ? Object.values((e.error?.errors ?? {}) as Record<string, string[]>).flat()[0]
          : undefined;
        if (fromDialog && typeof first === 'string') this.rejectError.set(first);
        // Someone else decided it meanwhile: show what it is now.
        if (e instanceof HttpErrorResponse && e.status === 422) this.load();
      },
    });
  }

  private show(r: ExternalTrainingRequest): void {
    this.request.set(r);
    this.qualificationId.set(r.qualification?.id ?? null);
    this.courseId.set(r.course?.id ?? null);
  }

  private loadStats(): void {
    this.api.stats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: s => this.stats.set(s), error: () => undefined });
  }

  private fail(): void {
    this.toast.add({ severity: 'error', summary: this.t.instant('common.error_title'), detail: this.t.instant('common.operation_failed') });
  }
}
