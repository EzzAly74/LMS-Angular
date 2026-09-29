import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ASSIGNMENT_TYPES } from '../../models/assignment.types';
import type { AssignmentType } from '../../models/assignment.types';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasFilterPickerComponent } from '../../../../shared/nas/nas-filter-picker/nas-filter-picker.component';
import type { NasFilterOption } from '../../../../shared/nas/nas-filter-picker/nas-filter-picker.component';
import { pluralKey } from '../../../../core/utils/plural-key';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { LocaleService } from '../../../../core/services/locale.service';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { AssignmentsApiService } from '../../services/assignments-api.service';
import { CoursesApiService } from '../../../courses/services/courses-api.service';
import type {
  AssignmentListItem,
  AssignmentOption,
  InstructorOption,
  SubmissionListItem,
} from '../../models/assignment.types';

/** Figma 1983:42584 "All / Passed / Failed" (D-065). */
type ResultToggle = 'all' | 'passed' | 'failed';

interface CourseOpt { id: number; title: string; }

/** The chips that open "Filter your results" (Figma 1986:75113). */
type PickerKind = 'instructors' | 'learners' | 'courses';

@Component({
  selector: 'app-assignment-list',
  standalone: true,
  imports: [
    NasDatePipe,
    CommonModule,
    FormsModule,
    RouterLink,
    DialogModule,
    SkeletonModule,
    ConfirmDialogModule,
    ToastModule,
    TranslateModule,
    NasIconComponent,
    NasPagerComponent,
    NasFilterPickerComponent,
  ],
  providers: [ConfirmationService, MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assignment-list.component.html',
  styleUrl: './assignment-list.component.scss',
})
export class AssignmentListComponent implements OnInit, OnDestroy {
  private readonly api        = inject(AssignmentsApiService);
  private readonly coursesApi = inject(CoursesApiService);
  private readonly confirm    = inject(ConfirmationService);
  private readonly toast      = inject(MessageService);
  private readonly router     = inject(Router);
  private readonly t          = inject(TranslateService);
  /** Dates follow the UI language (D-051); Angular's date pipe was always English. */
  protected readonly locale   = inject(LocaleService).locale;

  private readonly destroy$   = new Subject<void>();
  private readonly subSearch$ = new Subject<string>();

  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min = Math.min;

  constructor() {
    // Reload every locale-dependent payload — primary table, filter-modal
    // lookups, and the cached learners list — so a EN ↔ AR switch never
    // leaves stale text on screen.
    withLocaleReload(() => {
      this.refresh();
      this.loadLookups();
      this.learners.set([]);
    });
  }

  /* ── Mini-table (top 5 created assignments) ─────────────────────── */
  readonly miniRows    = signal<AssignmentListItem[]>([]);
  readonly miniLoading = signal(true);
  readonly summary     = signal<{ assignments: number; courses: number }>({ assignments: 0, courses: 0 });

  /* ── Submissions table ──────────────────────────────────────── */
  readonly submissions        = signal<SubmissionListItem[]>([]);
  readonly submissionsTotal   = signal(0);
  readonly submissionsLoading = signal(true);

  subPage    = 1;
  /** Figma 1983:42584 draws ten rows a page. */
  subPerPage = 10;
  subSearch  = '';
  subResult: ResultToggle = 'all';
  /** Pre / Mid / Post filter (Figma 1981:41345). */
  subTypes: AssignmentType[] = [];
  subInstructorIds: number[] = [];
  subLearnerIds:    number[] = [];
  subCourseIds:     number[] = [];

  /* ── Lookup data ────────────────────────────────────────────── */
  readonly instructors = signal<InstructorOption[]>([]);
  readonly courses     = signal<CourseOpt[]>([]);
  readonly learners    = signal<{ id: number; name: string }[]>([]);

  /* ── "View All" modal ───────────────────────────────────────── */
  readonly viewAllOpen     = signal(false);
  readonly viewAllLoading  = signal(false);
  readonly viewAllItems    = signal<AssignmentOption[]>([]);
  readonly viewAllSelected = signal<number | null>(null);
  viewAllSearch = '';

  /* ── Filter chips ───────────────────────────────────────────── */
  readonly chips: readonly { kind: PickerKind | 'types'; label: string }[] = [
    { kind: 'instructors', label: 'assignments.filter_instructors' },
    { kind: 'learners',    label: 'assignments.filter_learners' },
    { kind: 'courses',     label: 'assignments.filter_courses' },
    { kind: 'types',       label: 'assignments.filter_type' },
  ];
  readonly results: readonly { value: ResultToggle; label: string }[] = [
    { value: 'all',    label: 'common.all' },
    { value: 'passed', label: 'quizzes.passed' },
    { value: 'failed', label: 'quizzes.failed' },
  ];
  /** Which "Filter your results" list is open. */
  readonly picker   = signal<PickerKind | null>(null);
  /** Assignment Type modal (Figma 1981:41345). */
  readonly typeOpen = signal(false);

  /**
   * DB-27: plain array fields are not signals, so these are methods, read
   * again on every change detection (the component runs on events only).
   */
  chipCount(kind: PickerKind | 'types'): number {
    switch (kind) {
      case 'instructors': return this.subInstructorIds.length;
      case 'learners':    return this.subLearnerIds.length;
      case 'courses':     return this.subCourseIds.length;
      case 'types':       return this.subTypes.length;
    }
  }

  noChipFilter(): boolean {
    return !this.subInstructorIds.length && !this.subLearnerIds.length && !this.subCourseIds.length && !this.subTypes.length;
  }

  /** "12 created assignments · for 5 courses", with the locale's plural forms. */
  plural(base: string, count: number): string {
    return pluralKey(base, count, this.locale());
  }

  ngOnInit(): void {
    this.subSearch$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        this.subSearch = v;
        this.subPage = 1;
        this.loadSubmissions();
      });

    this.loadLookups();
    this.refresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Loaders ────────────────────────────────────────────────── */

  refresh(): void {
    this.loadMini();
    this.loadSubmissions();
  }

  private loadLookups(): void {
    this.api.instructors().subscribe({
      next: res => this.instructors.set(res.result ?? []),
    });
    this.coursesApi.list({ per_page: 200 }).subscribe({
      next: res => this.courses.set((res.result.data ?? []) as unknown as CourseOpt[]),
    });
  }

  private loadMini(): void {
    this.miniLoading.set(true);
    this.api.list({ per_page: 5, page: 1 }).subscribe({
      next: res => {
        this.miniRows.set(res.result.data ?? []);
        this.miniLoading.set(false);
      },
      error: () => this.miniLoading.set(false),
    });
    this.api.summary().subscribe({
      next: res => this.summary.set({
        assignments: res.result.assignments_count,
        courses: res.result.courses_count,
      }),
    });
  }

  private loadSubmissions(): void {
    this.submissionsLoading.set(true);
    this.api.listSubmissions({
      page: this.subPage,
      per_page: this.subPerPage,
      ...(this.subSearch ? { search: this.subSearch } : {}),
      ...(this.subResult !== 'all' ? { result: this.subResult } : {}),
      ...(this.subTypes.length ? { types: [...this.subTypes] } : {}),
      ...(this.subInstructorIds.length ? { instructor_ids: this.subInstructorIds } : {}),
      ...(this.subLearnerIds.length    ? { learner_ids:    this.subLearnerIds    } : {}),
      ...(this.subCourseIds.length     ? { course_ids:     this.subCourseIds     } : {}),
    }).subscribe({
      next: res => {
        this.submissions.set(res.result.data ?? []);
        this.submissionsTotal.set(res.result.total ?? 0);
        this.submissionsLoading.set(false);
      },
      error: () => this.submissionsLoading.set(false),
    });
  }

  /* ── Submissions interactions ────────────────────────────────── */

  onSubmissionSearch(v: string): void { this.subSearch$.next(v); }

  onResult(s: ResultToggle): void {
    this.subResult = s;
    this.subPage = 1;
    this.loadSubmissions();
  }

  onSubPage(p: number): void {
    if (p < 1) return;
    this.subPage = p;
    this.loadSubmissions();
  }

  openSubmission(item: SubmissionListItem): void {
    this.router.navigate(['/admin/assignments/submissions', item.id]);
  }

  /* ── Mini-table interactions ─────────────────────────────────── */

  editAssignment(item: AssignmentListItem, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/admin/assignments', item.id, 'edit']);
  }

  confirmDelete(item: AssignmentListItem, event: MouseEvent): void {
    event.stopPropagation();
    this.confirm.confirm({
      message: this.t.instant('confirm.delete_message_title', { title: item.title }),
      header: this.t.instant('assignments_list_toasts.delete_title'),
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-secondary p-button-sm',
      accept: () => {
        this.api.delete(item.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              detail: this.t.instant('assignments_list_toasts.deleted'),
            });
            this.refresh();
          },
        });
      },
    });
  }

  /* ── "View All" modal ────────────────────────────────────────── */

  openViewAll(): void {
    this.viewAllSelected.set(null);
    this.viewAllSearch = '';
    this.viewAllOpen.set(true);
    this.loadAllAssignments();
  }

  loadAllAssignments(): void {
    this.viewAllLoading.set(true);
    this.api.listMinimal(this.viewAllSearch || undefined).subscribe({
      next: res => {
        this.viewAllItems.set(res.result ?? []);
        this.viewAllLoading.set(false);
      },
      error: () => this.viewAllLoading.set(false),
    });
  }

  onViewAllSearchChange(v: string): void {
    this.viewAllSearch = v;
    this.loadAllAssignments();
  }

  selectViewAllItem(item: AssignmentOption): void {
    this.viewAllSelected.set(this.viewAllSelected() === item.id ? null : item.id);
  }

  confirmViewAll(): void {
    const id = this.viewAllSelected();
    if (!id) return;
    this.viewAllOpen.set(false);
    this.router.navigate(['/admin/assignments', id, 'edit']);
  }

  /* ── Filter chips ────────────────────────────────────────────── */

  openChip(kind: PickerKind | 'types'): void {
    if (kind === 'types') { this.typeOpen.set(true); return; }
    if (kind === 'learners') this.loadLearners();
    this.picker.set(kind);
  }

  pickerLabel(): string {
    const kind = this.picker();
    return kind ? this.t.instant(`assignments.filter_${kind}`) : '';
  }

  pickerOptions(): NasFilterOption[] {
    switch (this.picker()) {
      case 'instructors': return this.instructors().map(i => ({ id: i.id, label: i.name }));
      case 'learners':    return this.learners().map(l => ({ id: l.id, label: l.name }));
      case 'courses':     return this.courses().map(c => ({ id: c.id, label: c.title }));
      default:            return [];
    }
  }

  pickerSelected(): number[] {
    switch (this.picker()) {
      case 'instructors': return this.subInstructorIds;
      case 'learners':    return this.subLearnerIds;
      case 'courses':     return this.subCourseIds;
      default:            return [];
    }
  }

  onPick(ids: (number | string)[]): void {
    const chosen = ids.map(Number);
    switch (this.picker()) {
      case 'instructors': this.subInstructorIds = chosen; break;
      case 'learners':    this.subLearnerIds = chosen; break;
      case 'courses':     this.subCourseIds = chosen; break;
    }
    this.subPage = 1;
    this.loadSubmissions();
  }

  typeOptions(): NasFilterOption[] {
    return ASSIGNMENT_TYPES.map(t => ({ id: t, label: this.t.instant(`quizzes.type_long_${t}`) }));
  }

  onTypes(ids: (number | string)[]): void {
    this.subTypes = ASSIGNMENT_TYPES.filter(t => ids.includes(t));
    this.subPage = 1;
    this.loadSubmissions();
  }

  /** "Show All" (Figma 1983:42584): one page of up to the API's 200 rows. */
  showAll(): void {
    this.subPerPage = 200;
    this.subPage = 1;
    this.loadSubmissions();
  }

  private loadLearners(): void {
    if (this.learners().length) return;
    this.api.listSubmissions({ per_page: 200 }).subscribe({
      next: res => {
        const seen = new Set<number>();
        const unique: { id: number; name: string }[] = [];
        for (const row of res.result.data ?? []) {
          if (row.user && !seen.has(row.user.id)) {
            seen.add(row.user.id);
            unique.push({ id: row.user.id, name: row.user.name });
          }
        }
        this.learners.set(unique);
      },
    });
  }

  clearAllFilters(): void {
    this.subInstructorIds = [];
    this.subLearnerIds = [];
    this.subCourseIds = [];
    this.subTypes = [];
    this.subPage = 1;
    this.loadSubmissions();
  }
  /* ── Helpers ────────────────────────────────────────────────── */

  cohortPillLabel(item: AssignmentListItem): string {
    if (item.cohort_scope === 'all') return this.t.instant('assignments.cohort_scope_all');
    const titles = (item.cohorts ?? [])
      .map(c => c.title)
      .filter((t): t is string => !!t);
    return titles.length ? titles.join(', ') : this.t.instant('assignments.cohort_scope_specific');
  }


  typeLabel(t: AssignmentType | null | undefined): string {
    return t ? this.t.instant(`quizzes.type_${t}`) : '—';
  }


}
