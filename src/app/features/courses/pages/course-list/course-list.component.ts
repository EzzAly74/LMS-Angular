import {
  ChangeDetectionStrategy, Component, OnInit, ViewChild,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import {
  NasPageHeaderComponent,
  NasPillTabsComponent,
  NasPillTab,
  NasStatusBadgeComponent,
  NasStatusTone,
  NasProgressComponent,
  NasLocaleInputComponent,
  NasDataTableComponent,
  NasCellTplDirective,
  NasTableColumn,
} from '../../../../shared/nas';
import { CoursesApiService } from '../../services/courses-api.service';
import type { LocalizedText } from '../../../../core/models/localized.types';
import { mapApiCourseListItem, type ApiCourseRaw } from '../../../../core/utils/course-mapper';

import type { Course, CourseStatus, CourseType } from '../../../../core/models/course.types';

type ActiveTab = 'all' | 'pending' | 'active' | 'upcoming' | 'inactive';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, DatePipe, DecimalPipe, TranslateModule,
    OverlayPanelModule, ConfirmDialogModule, DialogModule,
    DropdownModule, CalendarModule, InputNumberModule, CheckboxModule,
    NasPageHeaderComponent, NasPillTabsComponent, NasStatusBadgeComponent, NasProgressComponent,
    NasLocaleInputComponent, NasDataTableComponent, NasCellTplDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-list.component.html',
  styleUrl: './course-list.component.scss',
})
export class CourseListComponent implements OnInit {
  @ViewChild('rowMenu') rowMenu!: OverlayPanel;

  private api            = inject(ApiService);
  private coursesApi     = inject(CoursesApiService);
  private fb             = inject(FormBuilder);
  private router         = inject(Router);
  private confirmService = inject(ConfirmationService);
  private toast          = inject(MessageService);

  /** True once the Add-Course modal lookups have been fetched at least once. */
  private selectOptionsLoaded = false;

  constructor() {
    withLocaleReload(() => {
      this.load();
      this.loadTabCounts();
      // Only re-fetch the modal lookups if they were already consumed —
      // avoids 3 extra network calls every time the locale changes for
      // pages where the user never opens the Add-Course dialog.
      if (this.selectOptionsLoaded) {
        this.loadSelectOptions();
      }
    });
  }

  items     = signal<Course[]>([]);
  total     = signal(0);
  loading   = signal(true);
  activeTab = signal<ActiveTab>('all');
  tabCounts = signal<Partial<Record<ActiveTab, number>>>({});

  activeRow = signal<Course | null>(null);

  /* Add Course modal */
  showAddCourse = signal(false);
  qualOptions   = signal<Array<{ id: number; name: string }>>([]);
  catOptions    = signal<Array<{ id: number; name: string }>>([]);
  instOptions   = signal<Array<{ id: number; name: string }>>([]);
  saving        = signal(false);

  /* Search */
  perPage = 15;
  page    = 1;
  search  = '';
  private search$ = new Subject<string>();

  /* Type select */
  typeOpts = [
    { id: 'online',        name: 'Online' },
    { id: 'offline',       name: 'Offline' },
    { id: 'hybrid',        name: 'Hybrid' },
    { id: 'external_link', name: 'External Link' },
  ];

  tabs = computed<NasPillTab[]>(() => [
    { id: 'all',      label: 'All',       count: this.tabCounts()['all']      ?? null },
    { id: 'pending',  label: 'Pending',   count: this.tabCounts()['pending']  ?? null },
    { id: 'active',   label: 'Active',    count: this.tabCounts()['active']   ?? null },
    { id: 'upcoming', label: 'Up coming', count: this.tabCounts()['upcoming'] ?? null },
    { id: 'inactive', label: 'Inactive',  count: this.tabCounts()['inactive'] ?? null },
  ]);

  readonly columns: NasTableColumn[] = [
    { field: 'course',     header: 'Course',     minWidth: '240px' },
    { field: 'category',   header: 'Category' },
    { field: 'instructor', header: 'Instructor' },
    { field: 'cohorts',    header: 'Cohorts',    align: 'start' },
    { field: 'enrolled',   header: 'Enrolled',   align: 'start' },
    { field: 'completion', header: 'Completion', minWidth: '140px' },
    { field: 'rating',     header: 'Rating' },
    { field: 'status',     header: 'Status' },
    { field: 'actions',    header: '',           headerless: true, width: '60px', align: 'end' },
  ];

  form = this.fb.group({
    title:               this.fb.control<LocalizedText>({ en: '', ar: '' }, Validators.required),
    type:                ['hybrid', Validators.required],
    category_id:         [null as number | null, Validators.required],
    instructor_id:       [null as number | null, Validators.required],
    certificate:         [true,  Validators.required],
    require_instructor:  [true,  Validators.required],
    description:         this.fb.control<LocalizedText>({ en: '', ar: '' }, Validators.required),
    hours:               [1, [Validators.required, Validators.min(1)]],
    max_learners:        [30,    [Validators.required, Validators.min(1)]],
    cohort_start:        [null as Date | null],
    cohort_end:          [null as Date | null],
    qualification_ids:   [[] as number[]],
    image:               [null as File | null],
  });

  ngOnInit(): void {
    this.search$.pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });

    // Fire the two cheap-and-required calls in parallel. Modal lookups
    // (categories / instructors / qualifications) are deferred until the
    // user actually clicks "Add Course".
    this.load();
    this.loadTabCounts();
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

  loadSelectOptions(): void {
    this.selectOptionsLoaded = true;
    this.api.get<Array<{ id: number; name: string }>>(API.CATEGORIES_ACTIVE).subscribe({
      next: r => this.catOptions.set(Array.isArray(r.result) ? r.result : []),
    });
    this.api.get<Array<{ id: number; name: string }>>(API.INSTRUCTORS_ALL).subscribe({
      next: r => this.instOptions.set(Array.isArray(r.result) ? r.result : []),
    });
    this.api.get<Array<{ id: number; name: string }>>(API.QUALIFICATIONS_ACTIVE).subscribe({
      next: r => this.qualOptions.set(Array.isArray(r.result) ? r.result : []),
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

  editCourse(course: Course): void {
    this.toast.add({ severity: 'info', summary: 'Edit', detail: course.title });
    this.rowMenu.hide();
  }

  /* ── Add Course modal ─────────────────────────────────────────────── */
  openAddCourse(): void {
    this.form.reset({
      title: { en: '', ar: '' }, type: 'hybrid', category_id: null, instructor_id: null,
      certificate: true, require_instructor: true, description: { en: '', ar: '' },
      hours: 1, max_learners: 30, cohort_start: null, cohort_end: null, qualification_ids: [], image: null,
    });
    // Fetch dropdown lookups lazily — keeps the initial page load
    // request count low (this is invoked only when an admin actually
    // wants to create a course).
    if (!this.selectOptionsLoaded) {
      this.loadSelectOptions();
    }
    this.showAddCourse.set(true);
  }

  submitAddCourse(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const fd = new FormData();
    const title = (v.title ?? {}) as LocalizedText;
    const desc  = (v.description ?? {}) as LocalizedText;
    const titleEn = (title.en ?? '').trim();
    const titleAr = (title.ar ?? '').trim();
    const descEn  = (desc.en ?? '').trim();
    const descAr  = (desc.ar ?? '').trim();
    fd.append('title[en]', titleEn || titleAr);
    fd.append('title[ar]', titleAr || titleEn);
    fd.append('description[en]', descEn || descAr);
    fd.append('description[ar]', descAr || descEn);
    const courseType = (v.type as 'online' | 'offline' | 'hybrid' | 'external_link') ?? 'offline';
    fd.append('course_type', courseType);
    fd.append('category_id', String(v.category_id!));
    fd.append('hours', String(v.hours ?? 1));
    fd.append('certificate', v.certificate ? '1' : '0');
    fd.append('instructors[]', String(v.instructor_id!));
    (v.qualification_ids ?? []).forEach((id: number) => fd.append('qualification_skill_ids[]', String(id)));
    if (v.image) fd.append('image', v.image);
    this.coursesApi.create(fd).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', detail: 'Course created' });
        this.showAddCourse.set(false);
        this.saving.set(false);
        this.load();
        this.loadTabCounts();
      },
      error: () => this.saving.set(false),
    });
  }

  private toIso(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
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
    return type === 'external_link' ? 'External Link' : type.charAt(0).toUpperCase() + type.slice(1);
  }
}
