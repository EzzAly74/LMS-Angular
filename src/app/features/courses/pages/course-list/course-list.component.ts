import {
  ChangeDetectionStrategy, Component, OnInit, ViewChild,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { ApiService } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import {
  NasPageHeaderComponent,
  NasPillTabsComponent,
  NasPillTab,
  NasStatusBadgeComponent,
  NasStatusTone,
  NasProgressComponent,
  NasDataTableComponent,
  NasCellTplDirective,
  NasTableColumn,
} from '../../../../shared/nas';
import { CoursesApiService } from '../../services/courses-api.service';
import { CourseDialogComponent } from '../../components/course-dialog/course-dialog.component';
import { mapApiCourseListItem, type ApiCourseRaw } from '../../../../core/utils/course-mapper';

import type { Course, CourseStatus, CourseType } from '../../../../core/models/course.types';

type ActiveTab = 'all' | 'pending' | 'active' | 'upcoming' | 'inactive';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [
    CommonModule, DatePipe, DecimalPipe, TranslateModule,
    OverlayPanelModule,
    NasPageHeaderComponent, NasPillTabsComponent, NasStatusBadgeComponent, NasProgressComponent,
    NasDataTableComponent, NasCellTplDirective, CourseDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-list.component.html',
  styleUrl: './course-list.component.scss',
})
export class CourseListComponent implements OnInit {
  @ViewChild('rowMenu') rowMenu!: OverlayPanel;

  private api            = inject(ApiService);
  private coursesApi     = inject(CoursesApiService);
  private enums          = inject(EnumsService);
  private router         = inject(Router);
  private route          = inject(ActivatedRoute);
  private t              = inject(TranslateService);

  constructor() {
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.load();
      this.loadTabCounts();
    });
  }

  items     = signal<Course[]>([]);
  total     = signal(0);
  loading   = signal(true);
  activeTab = signal<ActiveTab>('all');
  tabCounts = signal<Partial<Record<ActiveTab, number>>>({});

  activeRow = signal<Course | null>(null);

  /* Add / Edit Course modal (D6) - null course id = Add. */
  dialogOpen     = signal(false);
  dialogCourseId = signal<number | null>(null);

  /* Search */
  perPage = 15;
  page    = 1;
  search  = '';
  private search$ = new Subject<string>();

  /**
   * Status-pill tabs are driven by the backend `course_status` enum. We
   * keep the pill `id` as the enum `code` (string) because the table's
   * `status` query-string filter is still a string column on the
   * backend. Labels come from the enum service and re-localize on
   * locale change automatically.
   */
  tabs = computed<NasPillTab[]>(() => {
    const opts = this.enums.options('course_status')();
    const counts = this.tabCounts();
    return opts
      .filter(o => o.code !== 'pending')
      .map(o => ({
        id: o.code,
        label: o.value,
        count: counts[o.code as ActiveTab] ?? null,
      }));
  });

  /**
   * Reactive column definitions — the `langTick` signal bumps on
   * `onLangChange` so column headers re-translate without a full reload.
   * The locale interceptor still re-fetches the dataset, but column
   * labels are pure i18n and only need a re-read of TranslateService.
   */
  readonly columns = computed<NasTableColumn[]>(() => {
    this.langTick();
    return [
      { field: 'course',     header: this.t.instant('courses_list.col_course'),     minWidth: '240px' },
      { field: 'category',   header: this.t.instant('courses_list.col_category') },
      { field: 'instructor', header: this.t.instant('courses_list.col_instructor') },
      { field: 'cohorts',    header: this.t.instant('courses_list.col_cohorts'),    align: 'start' },
      { field: 'enrolled',   header: this.t.instant('courses_list.col_enrolled'),   align: 'start' },
      { field: 'completion', header: this.t.instant('courses_list.col_completion'), minWidth: '140px' },
      { field: 'evaluation', header: this.t.instant('courses_list.col_evaluation') },
      { field: 'status',     header: this.t.instant('courses_list.col_status') },
      { field: 'actions',    header: '',                                            headerless: true, width: '60px', align: 'end' },
    ];
  });

  /** Bumps on every locale switch so the `columns` computed re-runs. */
  private readonly langTick = signal(0);

  ngOnInit(): void {
    this.search$.pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });

    this.load();
    this.loadTabCounts();

    // The dashboard's "Add Course" lands here with ?new=1: open the modal,
    // then drop the flag so Back / refresh don't reopen it.
    if (this.route.snapshot.queryParamMap.get('new') === '1') {
      this.openAddCourse();
      this.router.navigate([], { relativeTo: this.route, queryParams: { new: null }, replaceUrl: true });
    }
  }

  /* ── Data ─────────────────────────────────────────────────────────── */
  load(): void {
    this.loading.set(true);
    const params: Record<string, string | number | boolean> = { page: this.page, per_page: this.perPage };
    if (this.search) params['search'] = this.search;
    if (this.activeTab() !== 'all') params['status'] = this.activeTab();

    this.api.getPaginated<Course>(API.COURSES, params).subscribe({
      next:  res => {
        this.items.set(res.result.data.map(c => mapApiCourseListItem(c as unknown as ApiCourseRaw)));
        this.total.set(res.result.total);
        this.loading.set(false);
      },
      error: ()  => this.loading.set(false),
    });
  }

  loadTabCounts(): void {
    // One backend round-trip computes every tab count via an aggregate
    // query — replaces what used to be four parallel paginated fetches.
    this.coursesApi.getTabCounts().subscribe({
      next: res => {
        const r = res.result;
        this.tabCounts.set({
          all:      r.all,
          active:   r.active,
          inactive: r.inactive,
          pending:  r.pending,
          upcoming: r.upcoming,
        });
      },
    });
  }

  /* ── Tabs / search / paging ───────────────────────────────────────── */
  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.page = 1;
    this.load();
  }

  onSearch(e: Event): void {
    this.search$.next((e.target as HTMLInputElement).value);
  }

  /* ── Row menu ─────────────────────────────────────────────────────── */
  openRowMenu(ev: Event, course: Course): void {
    this.activeRow.set(course);
    this.rowMenu.toggle(ev);
  }

  goToDetail(course: Course): void {
    this.router.navigate(['/admin/courses', course.id]);
    this.rowMenu.hide();
  }

  /** Edit Course from the row menu: the same modal as Add, filled in. */
  editCourse(course: Course): void {
    this.rowMenu.hide();
    this.dialogCourseId.set(course.id);
    this.dialogOpen.set(true);
  }

  openAddCourse(): void {
    this.dialogCourseId.set(null);
    this.dialogOpen.set(true);
  }

  onCourseSaved(): void {
    this.load();
    this.loadTabCounts();
  }

  /* ── Pagination ───────────────────────────────────────────────────── */
  onPage(p: number): void { this.page = p; this.load(); }

  /* ── Helpers ──────────────────────────────────────────────────────── */
  statusTone(status: CourseStatus | undefined): NasStatusTone {
    switch (status) {
      case 'active':   return 'success';
      case 'pending':  return 'info';
      case 'upcoming': return 'warning';
      case 'inactive': return 'danger';
      default:         return 'neutral';
    }
  }

  statusLabel(status: CourseStatus | undefined): string {
    switch (status) {
      case 'active':   return this.t.instant('common.active');
      case 'pending':  return this.t.instant('courses.status_pending');
      case 'upcoming': return this.t.instant('courses.status_upcoming');
      case 'inactive': return this.t.instant('common.inactive');
      default:         return '';
    }
  }

  typeTone(type: CourseType | undefined): NasStatusTone {
    switch (type) {
      case 'online':        return 'teal';
      case 'offline':       return 'neutral';
      case 'hybrid':        return 'success';
      case 'external_link': return 'sky';
      default:              return 'neutral';
    }
  }

  typeLabel(type: CourseType | undefined): string {
    if (!type) return '';
    switch (type) {
      case 'online':        return this.t.instant('courses.type_online');
      case 'offline':       return this.t.instant('courses.type_offline');
      case 'hybrid':        return this.t.instant('courses.type_hybrid');
      case 'external_link': return this.t.instant('courses.type_external_link');
      default:              return '';
    }
  }
}
