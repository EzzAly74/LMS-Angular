import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { MessageService } from 'primeng/api';
import {
  NasDatepickerComponent,
  NasIconComponent,
  NasStatusBadgeComponent,
  CohortAttendanceDrawerComponent,
} from '../../../../../../shared/nas';
import type { NasStatusTone } from '../../../../../../shared/nas/nas-status-badge/nas-status-badge.component';
import {
  NasFilterDialogComponent,
  NasFilterField,
  NasFilterValues,
} from '../../../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
import { NasDatePipe } from '../../../../../../shared/pipes/nas-date.pipes';
import { CoursesApiService } from '../../../../services/courses-api.service';
import { EnumsService } from '../../../../../../core/services/enums.service';
import { LocaleService } from '../../../../../../core/services/locale.service';
import { pluralKey } from '../../../../../../core/utils/plural-key';
import { withLocaleReload } from '../../../../../../core/utils/with-locale-reload';
import type { Cohort, CohortPayload, CohortStatus, CourseDetail } from '../../../../../../core/models/course.types';
import { CohortLearnersDialogComponent } from './cohort-learners-dialog.component';

type SortKey = 'name' | 'status';

/**
 * Course Details - Cohort tab (Figma 2266:129041, row menu 2266:129226,
 * learners modal 2276:133999).
 *
 * Search, Filter (Figma note: "Cohort, Status") and the Cohort / Status
 * header sorts run in the page: a course has a handful of cohorts and the
 * list endpoint returns them all. "Enrolled / Capacity" opens the cohort's
 * learners. The row menu is Edit Cohort and View Attendance, as drawn.
 *
 * The Add / Edit Cohort dialog is the existing one (Figma 332:9988 /
 * 332:10708), moved here unchanged; the redesigned New Cohort modal with the
 * schedule upload (2393:123167) is D2 step 2.
 */
@Component({
  selector: 'app-course-cohorts-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    DialogModule,
    DropdownModule,
    OverlayPanelModule,
    NasDatepickerComponent,
    NasIconComponent,
    NasStatusBadgeComponent,
    CohortAttendanceDrawerComponent,
    NasFilterDialogComponent,
    NasDatePipe,
    CohortLearnersDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-cohorts-tab.component.html',
  styleUrl: './course-cohorts-tab.component.scss',
})
export class CourseCohortsTabComponent {
  private readonly coursesApi = inject(CoursesApiService);
  private readonly enums = inject(EnumsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly t = inject(TranslateService);
  protected readonly locale = inject(LocaleService).locale;

  readonly courseId = input.required<number>();
  readonly course = input.required<CourseDetail>();
  readonly cohorts = input<Cohort[]>([]);
  /** A cohort was added or edited: the page reloads the course and cohorts. */
  readonly changed = output<void>();

  private readonly langTick = signal(0);

  // ── List: search, filter, sort ─────────────────────────────────────────
  readonly search = signal('');
  readonly filter = signal<{ cohort: number | null; status: string | null }>({ cohort: null, status: null });
  readonly sort = signal<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);
  readonly filterOpen = signal(false);

  readonly activeFilters = computed(() => (this.filter().cohort !== null ? 1 : 0) + (this.filter().status !== null ? 1 : 0));

  readonly rows = computed(() => {
    this.langTick();
    const q = this.search().trim().toLocaleLowerCase();
    const f = this.filter();
    let list = this.cohorts().filter(c =>
      (!q || (c.name ?? '').toLocaleLowerCase().includes(q)) &&
      (f.cohort === null || c.id === f.cohort) &&
      (f.status === null || this.statusKey(c) === f.status),
    );
    const s = this.sort();
    if (s) {
      const dir = s.dir === 'asc' ? 1 : -1;
      const value = (c: Cohort) => (s.key === 'name' ? c.name ?? '' : this.cohortStatusLabel(c));
      list = [...list].sort((a, b) => value(a).localeCompare(value(b), this.locale()) * dir);
    }
    return list;
  });

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    const statuses = new Map<string, string>();
    for (const c of this.cohorts()) statuses.set(this.statusKey(c), this.cohortStatusLabel(c));
    return [
      {
        key: 'cohort',
        label: this.t.instant('course_detail.cohort'),
        placeholder: this.t.instant('course_detail.select_cohort'),
        options: this.cohorts().map(c => ({ id: c.id, label: c.name || this.t.instant('course_detail.unnamed_cohort') })),
      },
      {
        key: 'status',
        label: this.t.instant('course_detail.status'),
        placeholder: this.t.instant('course_detail.select_status'),
        options: [...statuses].map(([id, label]) => ({ id, label })),
      },
    ];
  });

  readonly appliedFilters = computed<NasFilterValues>(() => ({ cohort: this.filter().cohort, status: this.filter().status }));

  constructor() {
    withLocaleReload(() => this.langTick.update(v => v + 1));
  }

  onFilter(v: NasFilterValues): void {
    this.filter.set({
      cohort: typeof v['cohort'] === 'number' ? v['cohort'] : null,
      status: typeof v['status'] === 'string' ? v['status'] : null,
    });
  }

  toggleSort(key: SortKey): void {
    const s = this.sort();
    this.sort.set(!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null);
  }

  ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    return s?.key === key ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  countKey(n: number): string {
    return pluralKey('course_detail.cohorts_count', n, this.locale());
  }

  // ── Cohort learners modal ──────────────────────────────────────────────
  readonly learnersOpen = signal(false);
  readonly learnersCohort = signal<Cohort | null>(null);

  openLearners(cohort: Cohort): void {
    this.learnersCohort.set(cohort);
    this.learnersOpen.set(true);
  }

  // ── Row menu, attendance drawer ────────────────────────────────────────
  readonly activeCohort = signal<Cohort | null>(null);
  readonly showAttendance = signal(false);
  readonly attendanceCohortId = signal<number | null>(null);
  readonly attendanceCohortName = signal('');

  openCohortMenu(ev: Event, cohort: Cohort, overlay: OverlayPanel): void {
    this.activeCohort.set(cohort);
    overlay.toggle(ev);
  }

  /** Cohort.id is the `course_sections.id` the attendance endpoint expects. */
  openCohortAttendance(cohort: Cohort, overlay: OverlayPanel): void {
    overlay.hide();
    this.attendanceCohortId.set(cohort.id);
    this.attendanceCohortName.set(cohort.name || '');
    this.showAttendance.set(true);
  }

  // ── Add / Edit Cohort dialog (moved unchanged from the course page) ───
  readonly showCohort = signal(false);
  readonly cohortEditMode = signal(false);
  readonly saving = signal(false);

  /**
   * Bilingual name + capacity + status + dates per Figma 332:9988 (new) and
   * 332:10708 (edit).
   */
  cohortForm = this.fb.group({
    name_en: ['', [Validators.required, Validators.maxLength(255)]],
    name_ar: ['', [Validators.required, Validators.maxLength(255)]],
    capacity: [null as number | null, [Validators.min(1), Validators.max(10000)]],
    status: [null as number | null],
    // Planned session count (Figma 332:10708). Defaults from the course,
    // editable per cohort; once this many sessions are held the cohort
    // completes (and raising it re-opens an already-completed cohort).
    number_of_sessions: [null as number | null, [Validators.required, Validators.min(1), Validators.max(1000)]],
    start_date: [null as Date | null, Validators.required],
    end_date: [null as Date | null, Validators.required],
    // Average session length in hours (Figma 332:9988). Drives the live
    // attendance-window length for this cohort's sessions.
    avg_session_time: [null as number | null, [Validators.min(0.25), Validators.max(24)]],
  });

  /** Cohort-status dropdown - driven by the backend `cohort_status` enum. */
  cohortStatusOpts = this.enums.options('cohort_status');

  /**
   * The only two statuses an admin may pick (Figma 332:10708): `scheduled`
   * and `open_for_enrollment`. `active` / `completed` follow the dates and
   * `inactive` is set elsewhere.
   */
  cohortStatusDropdownOpts = computed(() =>
    this.cohortStatusOpts().filter(o => o.code === 'scheduled' || o.code === 'open_for_enrollment'),
  );

  enumCode(name: 'cohort_status', id: number | null | undefined): string | null {
    if (id === null || id === undefined) return null;
    return this.enums.codeForId(name, id);
  }

  openAddCohort(): void {
    this.cohortEditMode.set(false);
    this.activeCohort.set(null);
    this.cohortForm.reset({
      name_en: '',
      name_ar: '',
      capacity: 30,
      status: this.enums.idForCode('cohort_status', 'scheduled'),
      number_of_sessions: this.course().number_of_sessions ?? null,
      start_date: null,
      end_date: null,
      avg_session_time: null,
    });
    this.showCohort.set(true);
  }

  openEditCohort(cohort: Cohort, overlay: OverlayPanel): void {
    overlay.hide();
    this.cohortEditMode.set(true);
    this.activeCohort.set(cohort);
    this.cohortForm.reset({
      name_en: cohort.name_en ?? cohort.name ?? '',
      name_ar: cohort.name_ar ?? cohort.name ?? '',
      capacity: cohort.capacity ?? null,
      // The dropdown offers the two manual choices; anything else maps back
      // to `scheduled`.
      status: this.enums.idForCode('cohort_status', cohort.status === 'open_for_enrollment' ? 'open_for_enrollment' : 'scheduled'),
      number_of_sessions: cohort.number_of_sessions ?? this.course().number_of_sessions ?? null,
      start_date: cohort.start_date ? new Date(cohort.start_date) : null,
      end_date: cohort.end_date ? new Date(cohort.end_date) : null,
      avg_session_time: cohort.avg_session_time ?? null,
    });
    this.showCohort.set(true);
  }

  submitCohort(): void {
    if (this.cohortForm.invalid) {
      this.cohortForm.markAllAsTouched();
      return;
    }
    const id = this.courseId();
    this.saving.set(true);
    const v = this.cohortForm.getRawValue();
    const statusCode = this.enums.codeForId('cohort_status', v.status ?? null) as CohortStatus | null;
    const body: CohortPayload = {
      name: { en: (v.name_en ?? '').trim(), ar: (v.name_ar ?? '').trim() },
      start_date: v.start_date ? this.toIso(v.start_date) : null,
      end_date: v.end_date ? this.toIso(v.end_date) : null,
      capacity: v.capacity ?? null,
      status: statusCode ?? null,
      number_of_sessions: v.number_of_sessions ?? null,
      avg_session_time: v.avg_session_time ?? null,
    };

    const editing = this.cohortEditMode() && this.activeCohort();
    const req = editing
      ? this.coursesApi.updateCohort(id, this.activeCohort()!.id, body)
      : this.coursesApi.createCohort(id, body);

    req.subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          detail: this.t.instant(editing ? 'course_detail_toasts.cohort_updated' : 'course_detail_toasts.cohort_created'),
        });
        this.saving.set(false);
        this.showCohort.set(false);
        this.changed.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  adjustCohortCapacity(delta: number): void {
    const current = Number(this.cohortForm.value.capacity ?? 0);
    this.cohortForm.patchValue({ capacity: Math.max(1, Math.min(10000, current + delta)) });
  }

  adjustCohortSessions(delta: number): void {
    const current = Number(this.cohortForm.value.number_of_sessions ?? 0);
    this.cohortForm.patchValue({ number_of_sessions: Math.max(1, Math.min(1000, current + delta)) });
  }

  private toIso(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
  }

  // ── Status chip ────────────────────────────────────────────────────────

  /** `scheduled` with a future start shows as "Up Coming" (Figma 332:9988). */
  private isUpcoming(cohort: Cohort): boolean {
    if (cohort.status !== 'scheduled' || !cohort.start_date) return false;
    const start = new Date(cohort.start_date);
    return !isNaN(start.getTime()) && start > new Date();
  }

  /** Filter key: the stored status, with an upcoming `scheduled` kept apart. */
  statusKey(cohort: Cohort): string {
    return this.isUpcoming(cohort) ? 'upcoming' : cohort.status;
  }

  cohortStatusLabel(cohort: Cohort): string {
    if (this.isUpcoming(cohort)) return this.t.instant('course_detail.up_coming');
    return this.enums.options('cohort_status')().find(o => o.code === cohort.status)?.value ?? cohort.status;
  }

  /** "N / M": the cohort's own capacity, else the course's per-cohort cap. */
  cohortCapacity(cohort: Cohort): number {
    return cohort.capacity ?? this.course().max_learners ?? 0;
  }

  cohortStatusTone(cohort: Cohort): NasStatusTone {
    const s = cohort.status;
    if (s === 'completed') return 'sky';
    if (s === 'active') return 'success';
    if (s === 'open_for_enrollment') return 'teal';
    if (s === 'inactive') return 'danger';
    return this.isUpcoming(cohort) ? 'info' : 'neutral';
  }
}
