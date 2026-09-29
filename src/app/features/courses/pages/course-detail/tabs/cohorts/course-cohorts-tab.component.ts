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
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import {
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
import { EnumsService } from '../../../../../../core/services/enums.service';
import { LocaleService } from '../../../../../../core/services/locale.service';
import { pluralKey } from '../../../../../../core/utils/plural-key';
import { withLocaleReload } from '../../../../../../core/utils/with-locale-reload';
import type { Cohort, CourseDetail } from '../../../../../../core/models/course.types';
import { CohortLearnersDialogComponent } from './cohort-learners-dialog.component';
import { NewCohortDialogComponent } from './new-cohort-dialog.component';

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
 * Add and Edit Cohort share the New Cohort modal with the schedule upload
 * (Figma 2393:123167): editing renames, changes the capacity and adds only
 * the new sessions of an uploaded sheet.
 */
@Component({
  selector: 'app-course-cohorts-tab',
  standalone: true,
  imports: [
    NewCohortDialogComponent,
    CommonModule,
    FormsModule,
    TranslateModule,
    OverlayPanelModule,
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
  private readonly enums = inject(EnumsService);
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

  // ── Add / Edit Cohort: one dialog (Figma 2393:123167; Edit must match New) ──
  readonly newCohortOpen = signal(false);
  /** The cohort being edited; null while adding. */
  readonly editCohort = signal<Cohort | null>(null);

  openAddCohort(): void {
    this.editCohort.set(null);
    this.newCohortOpen.set(true);
  }

  openEditCohort(cohort: Cohort, overlay: OverlayPanel): void {
    overlay.hide();
    this.editCohort.set(cohort);
    this.newCohortOpen.set(true);
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
