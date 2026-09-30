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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import {
  AssigneeType,
  Assignees,
  JobTitleOption,
  LearnerOption,
  NAME_MAX,
  QualificationDetail,
  QualificationPayload,
} from '../../models/qualification.model';
import { QualificationsApiService } from '../../services/qualifications-api.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { ToastService } from '../../../../core/services/toast.service';

type LoadState = 'loading' | 'ready' | 'error';

/** One row of the unified checkbox list. */
interface AssigneeRow {
  key: string;
  kind: 'job_title' | 'learner';
  id: number;
  name: string;
  employees: number | null;
  employeeId: string | null;
  checked: boolean;
}

let nextId = 0;

/**
 * New / Edit Qualification - Figma 2066:100876.
 *
 * Both names, then "Qualification assignment": one search over job titles and
 * learners, All / Job Titles / Learners chips, and a single checkbox list with
 * an "N selected" count, the chosen rows first. One submit sets names, job
 * titles and direct grants together (POST / PUT admin/qualification-skills).
 *
 * Figma draws only the new, empty state. Edit opens the same modal filled in
 * (FG-31). Unticking a learner removes the direct grant only; a learner who
 * completed the linked courses still holds it (D-056).
 */
@Component({
  selector: 'app-qualification-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, DialogModule, SkeletonModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qualification-dialog.component.html',
  styleUrl: './qualification-dialog.component.scss',
})
export class QualificationDialogComponent {
  private readonly api        = inject(QualificationsApiService);
  private readonly fb         = inject(NonNullableFormBuilder);
  private readonly toast      = inject(ToastService);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document   = inject(DOCUMENT);

  readonly visible = model(false);
  /** null = New Qualification. */
  readonly qualificationId = input<number | null>(null);
  readonly saved = output<void>();

  protected readonly uid = `qd-${nextId++}`;
  protected readonly nameMax = NAME_MAX;
  protected readonly nameFields = [
    { ctrl: 'name_en', label: 'qualifications.name_en', ph: 'qualifications.name_en_placeholder', dir: 'ltr' },
    { ctrl: 'name_ar', label: 'qualifications.name_ar', ph: 'qualifications.name_ar_placeholder', dir: 'rtl' },
  ] as const;
  protected readonly filters: readonly { value: AssigneeType; key: string }[] = [
    { value: 'all', key: 'qualifications.dialog.all' },
    { value: 'job_titles', key: 'qualifications.dialog.job_titles' },
    { value: 'learners', key: 'qualifications.dialog.learners' },
  ];

  protected readonly form = this.fb.group({
    name_en: ['', [Validators.required, Validators.maxLength(NAME_MAX)]],
    name_ar: ['', [Validators.required, Validators.maxLength(NAME_MAX)]],
  });
  private readonly formValid = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status), map(s => s === 'VALID')),
    { initialValue: false },
  );

  protected readonly state         = signal<LoadState>('ready');
  protected readonly saving        = signal(false);
  protected readonly serverError   = signal<string | null>(null);
  protected readonly fieldErrors   = signal<Partial<Record<'name_en' | 'name_ar', string>>>({});
  protected readonly filter        = signal<AssigneeType>('all');
  protected readonly search        = signal('');
  protected readonly results       = signal<Assignees>({ job_titles: [], learners: [] });
  protected readonly searching     = signal(false);
  protected readonly searchFailed  = signal(false);
  protected readonly pickedTitles  = signal<ReadonlyMap<number, JobTitleOption>>(new Map());
  protected readonly pickedLearners = signal<ReadonlyMap<number, LearnerOption>>(new Map());
  /** False when the qualification has more direct grants than the modal lists. */
  protected readonly learnersEditable = signal(true);
  protected readonly learnersTotal   = signal(0);

  protected readonly editing = computed(() => this.qualificationId() !== null);
  protected readonly selectedCount = computed(() => this.pickedTitles().size + this.pickedLearners().size);

  protected readonly rows = computed<AssigneeRow[]>(() => {
    const type = this.filter();
    const term = this.search().trim().toLocaleLowerCase();
    const matches = (name: string, extra: string | null) =>
      !term || name.toLocaleLowerCase().includes(term) || (extra ?? '').toLocaleLowerCase().includes(term);
    const titleRow = (o: JobTitleOption, checked: boolean): AssigneeRow =>
      ({ key: `t${o.id}`, kind: 'job_title', id: o.id, name: o.name, employees: o.employees, employeeId: null, checked });
    const learnerRow = (o: LearnerOption, checked: boolean): AssigneeRow =>
      ({ key: `l${o.id}`, kind: 'learner', id: o.id, name: o.name, employees: null, employeeId: o.employee_id, checked });

    const titles = type !== 'learners';
    const learners = type !== 'job_titles';
    const picked: AssigneeRow[] = [
      ...(titles ? [...this.pickedTitles().values()].filter(o => matches(o.name, null)).map(o => titleRow(o, true)) : []),
      ...(learners ? [...this.pickedLearners().values()].filter(o => matches(o.name, o.employee_id)).map(o => learnerRow(o, true)) : []),
    ];
    const found: AssigneeRow[] = [
      ...(titles ? this.results().job_titles.filter(o => !this.pickedTitles().has(o.id)).map(o => titleRow(o, false)) : []),
      ...(learners && this.learnersEditable()
        ? this.results().learners.filter(o => !this.pickedLearners().has(o.id)).map(o => learnerRow(o, false))
        : []),
    ];
    return [...picked, ...found];
  });

  protected readonly canSubmit = computed(() => this.state() === 'ready' && this.formValid() && !this.saving());

  private readonly query$ = new Subject<{ search: string; type: AssigneeType }>();
  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const id = this.qualificationId();
      untracked(() => this.open(id));
    }, { allowSignalWrites: true });

    // Job-title names are localized: re-run the search in the new language.
    withLocaleReload(() => {
      if (this.visible()) this.query$.next({ search: this.search(), type: this.filter() });
    });

    this.query$
      .pipe(
        debounceTime(250),
        switchMap(q => {
          this.searching.set(true);
          return this.api.assignees(q.search, q.type).pipe(
            map(r => ({ ok: true as const, r })),
            catchError(() => of({ ok: false as const, r: { job_titles: [], learners: [] } as Assignees })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ ok, r }) => {
        this.results.set(r);
        this.searchFailed.set(!ok);
        this.searching.set(false);
      });
  }

  protected onSearch(term: string): void {
    this.search.set(term);
    this.query$.next({ search: term, type: this.filter() });
  }

  protected setFilter(type: AssigneeType): void {
    this.filter.set(type);
    this.query$.next({ search: this.search(), type });
  }

  protected toggle(row: AssigneeRow): void {
    if (row.kind === 'job_title') {
      const next = new Map(this.pickedTitles());
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, { id: row.id, name: row.name, employees: row.employees ?? 0 });
      this.pickedTitles.set(next);
      return;
    }
    const next = new Map(this.pickedLearners());
    if (next.has(row.id)) next.delete(row.id);
    else next.set(row.id, { id: row.id, name: row.name, employee_id: row.employeeId });
    this.pickedLearners.set(next);
  }

  /** A server error on a name no longer applies once the name is edited. */
  protected clearFieldError(name: 'name_en' | 'name_ar'): void {
    if (!this.fieldErrors()[name]) return;
    const { [name]: _gone, ...rest } = this.fieldErrors();
    this.fieldErrors.set(rest);
  }

  protected fieldInvalid(name: 'name_en' | 'name_ar'): boolean {
    const c = this.form.controls[name];
    return (c.invalid && c.touched) || !!this.fieldErrors()[name];
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (!this.canSubmit()) return;

    const v = this.form.getRawValue();
    const body: QualificationPayload = {
      name: { en: v.name_en.trim(), ar: v.name_ar.trim() },
      job_title_ids: [...this.pickedTitles().keys()],
    };
    if (this.learnersEditable()) body.learner_ids = [...this.pickedLearners().keys()];

    const id = this.qualificationId();
    this.saving.set(true);
    this.serverError.set(null);
    this.fieldErrors.set({});
    (id === null ? this.api.create(body) : this.api.update(id, body))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success(this.t.instant(id === null ? 'qualifications.created' : 'qualifications.saved'));
          this.saved.emit();
          this.visible.set(false);
        },
        error: (e: unknown) => {
          this.saving.set(false);
          this.showError(e);
        },
      });
  }

  protected close(): void {
    if (!this.saving()) this.visible.set(false);
  }

  protected restoreFocus(): void {
    this.opener?.focus();
    this.opener = null;
  }

  protected retry(): void {
    this.open(this.qualificationId());
  }

  private open(id: number | null): void {
    const active = this.document.activeElement;
    this.opener ??= active instanceof HTMLElement ? active : null;
    this.form.reset({ name_en: '', name_ar: '' });
    this.serverError.set(null);
    this.fieldErrors.set({});
    this.filter.set('all');
    this.search.set('');
    this.pickedTitles.set(new Map());
    this.pickedLearners.set(new Map());
    this.learnersEditable.set(true);
    this.learnersTotal.set(0);
    this.query$.next({ search: '', type: 'all' });

    if (id === null) {
      this.state.set('ready');
      return;
    }
    this.state.set('loading');
    this.api.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: d => this.fill(d),
      error: () => this.state.set('error'),
    });
  }

  private fill(d: QualificationDetail): void {
    this.form.reset({ name_en: d.name.en ?? '', name_ar: d.name.ar ?? '' });
    this.pickedTitles.set(new Map(d.job_titles.map(o => [o.id, o])));
    this.pickedLearners.set(new Map(d.learners.map(o => [o.id, o])));
    this.learnersEditable.set(d.learners_editable);
    this.learnersTotal.set(d.learners_total);
    this.state.set('ready');
  }

  /** A 422 goes next to its field; anything else to the alert above the footer. */
  private showError(e: unknown): void {
    if (e instanceof HttpErrorResponse && e.status === 422) {
      const errors = (e.error?.errors ?? {}) as Record<string, string[]>;
      const fields: Partial<Record<'name_en' | 'name_ar', string>> = {};
      if (errors['name.en']?.[0]) fields.name_en = errors['name.en'][0];
      if (errors['name.ar']?.[0]) fields.name_ar = errors['name.ar'][0];
      this.fieldErrors.set(fields);
      const other = Object.entries(errors).find(([k]) => k !== 'name.en' && k !== 'name.ar')?.[1]?.[0];
      if (other) this.serverError.set(other);
      return;
    }
    this.serverError.set(this.t.instant('common.operation_failed'));
  }
}
