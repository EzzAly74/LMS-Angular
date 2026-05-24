import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
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
import {
  NasPageHeaderComponent,
  NasStatusBadgeComponent,
} from '../../../../shared/nas';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { AssignmentsApiService } from '../../services/assignments-api.service';
import { CoursesApiService } from '../../../courses/services/courses-api.service';
import type {
  AssignmentListItem,
  AssignmentOption,
  AssignmentStatus,
  InstructorOption,
  SubmissionListItem,
  SubmissionStatus,
} from '../../models/assignment.types';

type StatusToggle = 'all' | SubmissionStatus;

interface CourseOpt { id: number; title: string; }

interface FilterModalState {
  open: boolean;
  kind: 'instructors' | 'learners' | 'courses' | null;
  query: string;
}

@Component({
  selector: 'app-assignment-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DialogModule,
    SkeletonModule,
    ConfirmDialogModule,
    ToastModule,
    TranslateModule,
    NasPageHeaderComponent,
    NasStatusBadgeComponent,
  ],
  providers: [ConfirmationService, MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assignment-list.component.html',
  styleUrl: './assignment-list.component.scss',
})
export class AssignmentListComponent implements OnInit, OnDestroy {
  private readonly api      = inject(AssignmentsApiService);
  private readonly coursesApi = inject(CoursesApiService);
  private readonly confirm  = inject(ConfirmationService);
  private readonly toast    = inject(MessageService);
  private readonly router   = inject(Router);
  private readonly t        = inject(TranslateService);

  private readonly destroy$ = new Subject<void>();
  private readonly subSearch$ = new Subject<string>();

  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min = Math.min;

  constructor() {
    withLocaleReload(() => this.refresh());
  }

  /* ── Mini-table (top 5 created assignments) ──────────────────── */
  readonly miniRows    = signal<AssignmentListItem[]>([]);
  readonly miniLoading = signal(true);
  readonly summary     = signal<{ assignments: number; courses: number }>({ assignments: 0, courses: 0 });

  /* ── Submissions table ───────────────────────────────────────── */
  readonly submissions        = signal<SubmissionListItem[]>([]);
  readonly submissionsTotal   = signal(0);
  readonly submissionsLoading = signal(true);

  subPage    = 1;
  subPerPage = 20;
  subSearch  = '';
  subStatus: StatusToggle = 'all';
  subInstructorIds: number[] = [];
  subLearnerIds:    number[] = [];
  subCourseIds:     number[] = [];

  /* ── Lookup data ─────────────────────────────────────────────── */
  readonly instructors  = signal<InstructorOption[]>([]);
  readonly courses      = signal<CourseOpt[]>([]);
  readonly learners     = signal<{ id: number; name: string }[]>([]);

  /* ── "View All" modal ────────────────────────────────────────── */
  readonly viewAllOpen     = signal(false);
  readonly viewAllLoading  = signal(false);
  readonly viewAllItems    = signal<AssignmentOption[]>([]);
  readonly viewAllSelected = signal<number | null>(null);
  viewAllSearch = '';

  /* ── Filter modal ────────────────────────────────────────────── */
  readonly filter = signal<FilterModalState>({ open: false, kind: null, query: '' });
  readonly selectedInstructorSet = signal<Set<number>>(new Set());
  readonly selectedLearnerSet    = signal<Set<number>>(new Set());
  readonly selectedCourseSet     = signal<Set<number>>(new Set());

  readonly filterPillCounts = computed(() => ({
    instructors: this.subInstructorIds.length,
    learners:    this.subLearnerIds.length,
    courses:     this.subCourseIds.length,
  }));

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

  /* ── Loaders ─────────────────────────────────────────────────── */

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
        courses:     res.result.courses_count,
      }),
    });
  }

  private loadSubmissions(): void {
    this.submissionsLoading.set(true);
    this.api.listSubmissions({
      page: this.subPage,
      per_page: this.subPerPage,
      ...(this.subSearch ? { search: this.subSearch } : {}),
      ...(this.subStatus !== 'all' ? { status: this.subStatus } : {}),
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

  onStatus(s: StatusToggle): void {
    this.subStatus = s;
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

  /* ── Filter modal ────────────────────────────────────────────── */

  openFilter(kind: 'instructors' | 'learners' | 'courses'): void {
    this.filter.set({ open: true, kind, query: '' });

    if (kind === 'instructors') {
      this.selectedInstructorSet.set(new Set(this.subInstructorIds));
    } else if (kind === 'learners') {
      this.selectedLearnerSet.set(new Set(this.subLearnerIds));
      this.loadLearners();
    } else {
      this.selectedCourseSet.set(new Set(this.subCourseIds));
    }
  }

  closeFilter(): void {
    this.filter.update(s => ({ ...s, open: false }));
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

  toggleFilterItem(id: number): void {
    const kind = this.filter().kind;
    if (kind === 'instructors') this.toggleInSet(this.selectedInstructorSet, id);
    else if (kind === 'learners') this.toggleInSet(this.selectedLearnerSet, id);
    else if (kind === 'courses')  this.toggleInSet(this.selectedCourseSet, id);
  }

  private toggleInSet(s: ReturnType<typeof signal<Set<number>>>, id: number): void {
    s.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isFilterSelected(id: number): boolean {
    const kind = this.filter().kind;
    if (kind === 'instructors') return this.selectedInstructorSet().has(id);
    if (kind === 'learners')    return this.selectedLearnerSet().has(id);
    if (kind === 'courses')     return this.selectedCourseSet().has(id);
    return false;
  }

  filterItems(): { id: number; name: string }[] {
    const q = this.filter().query.trim().toLowerCase();
    const kind = this.filter().kind;
    let source: { id: number; name: string }[] = [];
    if (kind === 'instructors') source = this.instructors();
    else if (kind === 'learners') source = this.learners();
    else if (kind === 'courses') source = this.courses().map(c => ({ id: c.id, name: c.title }));
    if (!q) return source;
    return source.filter(x => x.name.toLowerCase().includes(q));
  }

  onFilterQuery(v: string): void {
    this.filter.update(s => ({ ...s, query: v }));
  }

  clearFilterSelection(): void {
    const kind = this.filter().kind;
    if (kind === 'instructors') this.selectedInstructorSet.set(new Set());
    else if (kind === 'learners') this.selectedLearnerSet.set(new Set());
    else if (kind === 'courses')  this.selectedCourseSet.set(new Set());
  }

  applyFilter(): void {
    const kind = this.filter().kind;
    if (kind === 'instructors') this.subInstructorIds = [...this.selectedInstructorSet()];
    else if (kind === 'learners') this.subLearnerIds = [...this.selectedLearnerSet()];
    else if (kind === 'courses')  this.subCourseIds  = [...this.selectedCourseSet()];
    this.closeFilter();
    this.subPage = 1;
    this.loadSubmissions();
  }

  clearAllFilters(): void {
    this.subInstructorIds = [];
    this.subLearnerIds = [];
    this.subCourseIds = [];
    this.selectedInstructorSet.set(new Set());
    this.selectedLearnerSet.set(new Set());
    this.selectedCourseSet.set(new Set());
    this.subPage = 1;
    this.loadSubmissions();
  }

  /* ── Helpers ─────────────────────────────────────────────────── */

  cohortPillLabel(item: AssignmentListItem): string {
    if (item.cohort_scope === 'all') return 'All cohorts';
    const titles = (item.cohorts ?? [])
      .map(c => c.title)
      .filter((t): t is string => !!t);
    return titles.length ? titles.join(', ') : 'Specific cohorts';
  }

  cohortPillTone(scope: AssignmentListItem['cohort_scope']): 'teal' | 'warning' {
    return scope === 'all' ? 'teal' : 'warning';
  }

  statusTone(s: SubmissionStatus): 'success' | 'warning' {
    return s === 'graded' ? 'success' : 'warning';
  }

  assignmentStatusTone(s: AssignmentStatus): 'success' | 'neutral' {
    return s === 'active' ? 'success' : 'neutral';
  }
}
