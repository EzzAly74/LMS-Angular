import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { MessageService, SharedModule } from 'primeng/api';
import { CoursesApiService } from '../../../../services/courses-api.service';
import { LocaleService } from '../../../../../../core/services/locale.service';
import { NasIconComponent } from '../../../../../../shared/nas/nas-icon/nas-icon.component';
import { NasImportProblem, NasImportReportComponent } from '../../../../../../shared/nas/nas-import-report/nas-import-report.component';
import { NasDatePipe } from '../../../../../../shared/pipes/nas-date.pipes';
import type { Cohort } from '../../../../../../core/models/course.types';

/** Figma: "Xls, Xlsx · Max. file size: 8MB" - the server enforces the same. */
const MAX_BYTES = 8 * 1024 * 1024;
const EXTENSIONS = ['xls', 'xlsx'] as const;

type FileProblem = 'type' | 'size' | null;

/**
 * New Cohort with its schedule - Figma 2393:123167 (before upload) and
 * 2393:122292 (file chosen), D2 step 8 / D-062.
 *
 * Step 1 downloads a sheet with one numbered row per planned session; step 2
 * takes the completed .xls / .xlsx. The server checks every row and either
 * creates the cohort with all its sessions or returns every problem, which is
 * shown in the shared import report - nothing is created in that case.
 *
 * Given a `cohort`, the same dialog edits it (Edit must match New Cohort):
 * the names and capacity are filled in, step 1 downloads the cohort's own
 * schedule, and step 2 is optional - the server adds only the sheet's new
 * sessions and refuses any change to a session already held.
 */
@Component({
  selector: 'app-new-cohort-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, DialogModule, SharedModule, NasIconComponent, NasImportReportComponent, NasDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-cohort-dialog.component.html',
  styleUrl: './new-cohort-dialog.component.scss',
})
export class NewCohortDialogComponent {
  private readonly api = inject(CoursesApiService);
  private readonly t = inject(TranslateService);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = inject(LocaleService).locale;

  readonly courseId = input.required<number>();
  /** The cohort to edit; null adds a new one. */
  readonly cohort = input<Cohort | null>(null);
  readonly visible = model(false);
  /** A cohort was added or saved. */
  readonly saved = output<void>();

  readonly editing = computed(() => this.cohort() !== null);

  readonly form = new FormGroup({
    name_en: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    name_ar: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    capacity: new FormControl<number | null>(30, [Validators.min(1), Validators.max(10000)]),
    // "Open for enrolment early" (Q-073): shown in the app before the start date.
    open_early: new FormControl(false, { nonNullable: true }),
  });

  /** Once a cohort has started its enrolment window follows the calendar; the switch is locked. */
  readonly started = computed(() => {
    const start = this.cohort()?.start_date;
    if (!start) return false;
    const today = new Date();
    return start.slice(0, 10) <= `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  /** Learners already in the edited cohort: the capacity cannot go below it (the server checks too). */
  readonly minCapacity = computed(() => Math.max(1, this.cohort()?.enrolled ?? 0));

  readonly file = signal<File | null>(null);
  readonly fileProblem = signal<FileProblem>(null);
  readonly dragging = signal(false);
  readonly downloading = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly reportOpen = signal(false);
  readonly report = signal<NasImportProblem[]>([]);

  private readonly formValid = signal(false);
  /** Edit: the names or capacity differ from the cohort's. */
  private readonly formChanged = signal(false);
  /** New: the schedule is required. Edit: something must have changed; the file is optional. */
  readonly canSubmit = computed(() => this.formValid() && !this.saving()
    && (this.editing() ? this.file() !== null || this.formChanged() : this.file() !== null));

  /** Figma's attachment row shows size and date ("8 MB . 31 Aug, 2022"): the file's own modified date. */
  readonly fileDate = computed(() => { const f = this.file(); return f ? new Date(f.lastModified) : null; });

  readonly fileFormat = computed(() => (this.file()?.name.split('.').pop() ?? '').toUpperCase());

  constructor() {
    this.form.statusChanges.pipe(takeUntilDestroyed()).subscribe(s => this.formValid.set(s === 'VALID'));
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.formChanged.set(this.differs()));

    // Start fresh the moment it opens. PrimeNG's onShow fires after the open
    // animation, so resetting there wiped whatever was typed meanwhile.
    effect(() => {
      if (this.visible()) untracked(() => this.onShow());
    }, { allowSignalWrites: true });
  }

  private differs(): boolean {
    const c = this.cohort();
    if (c === null) return true;
    const v = this.form.getRawValue();
    return v.name_en.trim() !== (c.name_en ?? '').trim() || v.name_ar.trim() !== (c.name_ar ?? '').trim()
      || (v.capacity ?? null) !== (c.capacity ?? null)
      || v.open_early !== (c.status === 'open_for_enrollment');
  }

  /** Each time the dialog opens: a fresh form (or the edited cohort), no file, no errors. */
  private onShow(): void {
    const c = this.cohort();
    this.form.controls.capacity.setValidators([Validators.min(this.minCapacity()), Validators.max(10000)]);
    this.form.reset(c
      ? { name_en: c.name_en ?? c.name ?? '', name_ar: c.name_ar ?? c.name ?? '', capacity: c.capacity ?? 30, open_early: c.status === 'open_for_enrollment' }
      : { name_en: '', name_ar: '', capacity: 30, open_early: false });
    if (this.started()) this.form.controls.open_early.disable({ emitEvent: false });
    else this.form.controls.open_early.enable({ emitEvent: false });
    this.formValid.set(this.form.valid);
    this.formChanged.set(false);
    this.file.set(null);
    this.fileProblem.set(null);
    this.submitted.set(false);
    this.serverError.set(null);
  }

  close(): void {
    if (!this.saving()) this.visible.set(false);
  }

  showError(name: 'name_en' | 'name_ar' | 'capacity'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  step(delta: number): void {
    const current = Number(this.form.controls.capacity.value ?? 0);
    this.form.controls.capacity.setValue(Math.max(this.minCapacity(), Math.min(10000, current + delta)));
  }

  downloadTemplate(): void {
    if (this.downloading()) return;
    this.downloading.set(true);
    const c = this.cohort();
    const download = c ? this.api.downloadCohortSchedule(this.courseId(), c.id) : this.api.downloadScheduleTemplate(this.courseId());
    download.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.downloading.set(false),
      error: () => {
        this.downloading.set(false);
        this.toast.add({ severity: 'error', detail: this.t.instant('course_detail.schedule.download_failed') });
      },
    });
  }

  onPick(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.take(el.files?.[0] ?? null);
    el.value = ''; // picking the same file again still fires change
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.take(event.dataTransfer?.files?.[0] ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  removeFile(): void {
    this.file.set(null);
    this.fileProblem.set(null);
  }

  size(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const file = this.file();
    if (this.form.invalid || this.saving() || !this.canSubmit()) return;

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.serverError.set(null);

    const c = this.cohort();
    if (c) {
      this.api.updateCohortWithSchedule(this.courseId(), c.id, {
        name_en: v.name_en.trim(),
        name_ar: v.name_ar.trim(),
        capacity: v.capacity,
        open_early: this.started() ? null : v.open_early,
        schedule: file,
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => {
          const added = res.result?.sessions_added ?? 0;
          const updated = res.result?.sessions_updated ?? 0;
          const detail = added > 0 || updated > 0
            ? this.t.instant('course_detail.schedule.updated_with_sessions', { added, updated })
            : this.t.instant('course_detail_toasts.cohort_updated');
          this.done(detail);
        },
        error: (e: unknown) => this.failed(e),
      });
      return;
    }

    if (file === null) return;
    this.api.createCohortWithSchedule(this.courseId(), {
      name_en: v.name_en.trim(),
      name_ar: v.name_ar.trim(),
      capacity: v.capacity,
      open_early: v.open_early,
      schedule: file,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.done(this.t.instant('course_detail_toasts.cohort_created')),
      error: (e: unknown) => this.failed(e),
    });
  }

  private done(detail: string): void {
    this.saving.set(false);
    this.toast.add({ severity: 'success', detail });
    this.visible.set(false);
    this.saved.emit();
  }

  /** Row problems open the import report (nothing was saved); anything else shows under the form. */
  private failed(e: unknown): void {
    this.saving.set(false);
    const rows = e instanceof HttpErrorResponse ? (e.error?.report?.errors as NasImportProblem[] | undefined) : undefined;
    if (rows?.length) {
      this.report.set(rows);
      this.reportOpen.set(true);
      return;
    }
    this.serverError.set(this.messageFrom(e));
  }

  private take(file: File | null): void {
    if (file === null) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!(EXTENSIONS as readonly string[]).includes(ext)) {
      this.fileProblem.set('type');
      return;
    }
    if (file.size > MAX_BYTES) {
      this.fileProblem.set('size');
      return;
    }
    this.fileProblem.set(null);
    this.file.set(file);
  }

  /** The API's first validation message (already in the request language), or a generic one. */
  private messageFrom(e: unknown): string {
    if (e instanceof HttpErrorResponse && e.status === 422) {
      const errors = (e.error?.errors ?? {}) as Record<string, string[] | string>;
      const first = Object.values(errors).flatMap(v => (Array.isArray(v) ? v : [v]))[0];
      if (typeof first === 'string') return first;
    }
    return this.t.instant('common.operation_failed');
  }
}
