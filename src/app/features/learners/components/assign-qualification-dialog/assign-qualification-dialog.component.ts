import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { EMPTY, Observable, Subject, catchError, debounceTime, expand, map, of, reduce, switchMap } from 'rxjs';
import { ApiParams, ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { LearnerRow } from '../../models/learner.model';

/** The bulk-grant API accepts at most this many learners per call. */
export const MAX_BULK_GRANT = 500;

type Mode = 'pick' | 'matching';

interface Option {
  id: number;
  label: string;
}

let nextId = 0;

/**
 * "Assign Qualification" on the Learners list (D-053).
 *
 * Figma 1983:44955 shows the button but no frame for the dialog, so this
 * follows the "Filter your results" dialog (1986:75113) and awaits designer
 * review (FG-25). One qualification, then either learners ticked from a
 * server search, or everyone matching the list's current filters. Both post
 * to POST admin/qualification-skills/{id}/learners, which takes up to 500
 * learners and reports how many were granted and how many already held it.
 */
@Component({
  selector: 'app-assign-qualification-dialog',
  standalone: true,
  imports: [TranslateModule, DialogModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assign-qualification-dialog.component.html',
  styleUrl: './assign-qualification-dialog.component.scss',
})
export class AssignQualificationDialogComponent {
  private readonly api        = inject(ApiService);
  private readonly toast      = inject(MessageService);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document   = inject(DOCUMENT);

  readonly visible = model(false);
  /** The list's current filter params, for "everyone matching". */
  readonly filterParams = input<ApiParams>({});
  /** How many learners the list's current filters match. */
  readonly matchingTotal = input(0);
  readonly assigned = output<void>();

  protected readonly uid = `aq-${nextId++}`;
  protected readonly max = MAX_BULK_GRANT;

  protected readonly qualifications = signal<Option[]>([]);
  protected readonly qualSearch     = signal('');
  protected readonly qualification  = signal<number | null>(null);

  protected readonly mode           = signal<Mode>('pick');
  protected readonly learnerResults = signal<Option[]>([]);
  protected readonly learnersLoading = signal(false);
  protected readonly picked         = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly saving         = signal(false);

  protected readonly filteredQuals = computed(() => {
    const q = this.qualSearch().trim().toLocaleLowerCase();
    return q ? this.qualifications().filter(o => o.label.toLocaleLowerCase().includes(q)) : this.qualifications();
  });

  protected readonly targetCount = computed(() =>
    this.mode() === 'pick' ? this.picked().size : this.matchingTotal(),
  );

  protected readonly tooMany = computed(() => this.mode() === 'matching' && this.matchingTotal() > MAX_BULK_GRANT);

  protected readonly canSubmit = computed(() =>
    !this.saving() && this.qualification() !== null && this.targetCount() > 0 && !this.tooMany(),
  );

  private readonly learnerSearch$ = new Subject<string>();
  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      untracked(() => this.reset());
    }, { allowSignalWrites: true });

    this.learnerSearch$
      .pipe(
        debounceTime(300),
        switchMap(term => {
          this.learnersLoading.set(true);
          return this.api
            .getPaginated<LearnerRow>(API.ADMIN_USERS, { role: 'learner', per_page: 50, ...(term ? { search: term } : {}) })
            .pipe(
              map(r => r.result.data.map(u => ({ id: u.id, label: u.name }))),
              catchError(() => of([] as Option[])),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(rows => {
        this.learnerResults.set(rows);
        this.learnersLoading.set(false);
      });
  }

  protected onQualSearch(term: string): void {
    this.qualSearch.set(term);
  }

  protected onLearnerSearch(term: string): void {
    this.learnerSearch$.next(term.trim());
  }

  protected isPicked(id: number): boolean {
    return this.picked().has(id);
  }

  protected togglePick(o: Option): void {
    const next = new Map(this.picked());
    if (next.has(o.id)) next.delete(o.id);
    else if (next.size < MAX_BULK_GRANT) next.set(o.id, o.label);
    this.picked.set(next);
  }

  protected submit(): void {
    const qualificationId = this.qualification();
    if (!this.canSubmit() || qualificationId === null) return;
    this.saving.set(true);

    const ids$: Observable<number[]> = this.mode() === 'pick'
      ? of([...this.picked().keys()])
      : this.allMatchingIds();

    ids$
      .pipe(
        switchMap(ids =>
          this.api.post<{ granted: number; already_held: number }>(
            `${API.ADMIN_QUALIFICATIONS}/${qualificationId}/learners`,
            { user_ids: ids },
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: res => {
          this.saving.set(false);
          const r = res.result ?? { granted: 0, already_held: 0 };
          this.toast.add({
            severity: 'success',
            summary: this.t.instant('learners.assign.done_title'),
            detail: this.t.instant('learners.assign.done', { granted: r.granted, held: r.already_held }),
          });
          this.assigned.emit();
          this.visible.set(false);
        },
        // The error interceptor already toasts the reason; just unlock.
        error: () => this.saving.set(false),
      });
  }

  protected close(): void {
    if (!this.saving()) this.visible.set(false);
  }

  protected restoreFocus(): void {
    this.opener?.focus();
    this.opener = null;
  }

  /** Every learner id the list's filters match, 100 per request (at most 5). */
  private allMatchingIds(): Observable<number[]> {
    const params = (page: number): ApiParams => ({ ...this.filterParams(), role: 'learner', page, per_page: 100 });
    const fetch = (page: number) =>
      this.api.getPaginated<LearnerRow>(API.ADMIN_USERS, params(page)).pipe(
        map(r => ({ page, last: r.result.last_page, ids: r.result.data.map(u => u.id) })),
      );
    return fetch(1).pipe(
      expand(p => (p.page < p.last && p.page < MAX_BULK_GRANT / 100 ? fetch(p.page + 1) : EMPTY)),
      reduce((all, p) => all.concat(p.ids), [] as number[]),
      map(ids => ids.slice(0, MAX_BULK_GRANT)),
    );
  }

  private reset(): void {
    const active = this.document.activeElement;
    this.opener = active instanceof HTMLElement ? active : null;
    this.qualification.set(null);
    this.qualSearch.set('');
    this.mode.set('pick');
    this.picked.set(new Map());
    this.learnerSearch$.next('');
    if (this.qualifications().length === 0) {
      this.api
        .get<{ id: number; name: string }[]>(API.QUALIFICATIONS_ACTIVE)
        .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
        .subscribe(res => this.qualifications.set((res?.result ?? []).map(q => ({ id: q.id, label: q.name }))));
    }
  }
}
