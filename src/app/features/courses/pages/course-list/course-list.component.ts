import {
  ChangeDetectionStrategy, Component, OnInit, ViewChild,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
  NasPhotoUploadComponent,
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
    NasLocaleInputComponent, NasDataTableComponent, NasCellTplDirective, NasPhotoUploadComponent,
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
  private t              = inject(TranslateService);

  /** True once the Add-Course modal lookups have been fetched at least once. */
  private selectOptionsLoaded = false;

  constructor() {
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
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

  /* Edit Course modal — populated from a fresh detail fetch so the form
     always reflects the canonical server state (description, category,
     instructor, certificate flag, etc.) rather than just the trimmed
     list-row payload. */
  showEditCourse = signal(false);
  editLoading    = signal(false);
  editSaving     = signal(false);
  editingId      = signal<number | null>(null);

  /** Preview URLs for the photo-upload widget on each dialog. Bound to
   *  `nas-photo-upload [value]` so the user sees the swap immediately
   *  even before the form is submitted. */
  addPhotoPreview  = signal<string | null>(null);
  editPhotoPreview = signal<string | null>(null);

  /* Search */
  perPage = 15;
  page    = 1;
  search  = '';
  private search$ = new Subject<string>();

  /* Type select — labels translated lazily so onLangChange refreshes them. */
  typeOpts = computed(() => {
    this.langTick();
    return [
      { id: 'online',        name: this.t.instant('courses.online') },
      { id: 'offline',       name: this.t.instant('courses.offline') },
      { id: 'hybrid',        name: this.t.instant('courses_list.type_hybrid') },
      { id: 'external_link', name: this.t.instant('courses_list.type_external_link') },
    ];
  });

  tabs = computed<NasPillTab[]>(() => {
    this.langTick();
    return [
      { id: 'all',      label: this.t.instant('courses_list.tab_all'),      count: this.tabCounts()['all']      ?? null },
      { id: 'pending',  label: this.t.instant('courses_list.tab_pending'),  count: this.tabCounts()['pending']  ?? null },
      { id: 'active',   label: this.t.instant('courses_list.tab_active'),   count: this.tabCounts()['active']   ?? null },
      { id: 'upcoming', label: this.t.instant('courses_list.tab_upcoming'), count: this.tabCounts()['upcoming'] ?? null },
      { id: 'inactive', label: this.t.instant('courses_list.tab_inactive'), count: this.tabCounts()['inactive'] ?? null },
    ];
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
      { field: 'rating',     header: this.t.instant('courses_list.col_rating') },
      { field: 'status',     header: this.t.instant('courses_list.col_status') },
      { field: 'actions',    header: '',                                            headerless: true, width: '60px', align: 'end' },
    ];
  });

  /** Bumps on every locale switch so the `columns` computed re-runs. */
  private readonly langTick = signal(0);

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

  /**
   * Edit Course form. Same shape as the detail-page dialog so admins get
   * the identical experience whether they edit from the list or from the
   * course detail page.
   */
  editForm = this.fb.group({
    title:         this.fb.control<LocalizedText>({ en: '', ar: '' }, Validators.required),
    description:   this.fb.control<LocalizedText>({ en: '', ar: '' }, Validators.required),
    type:          ['hybrid' as CourseType, Validators.required],
    category_id:   [null as number | null, Validators.required],
    instructor_id: [null as number | null, Validators.required],
    hours:         [1,  [Validators.required, Validators.min(1)]],
    max_learners:  [30, [Validators.required, Validators.min(1)]],
    certificate:   [true],
    active:        [true],
    image:         [null as File | null],
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

  /**
   * Open the Edit Course popup over the list. We refetch the full course
   * record because the list payload is intentionally trimmed (no
   * description, no category/instructor relations), and prime the modal
   * lookups on the first open so the dropdowns aren't empty.
   */
  editCourse(course: Course): void {
    this.rowMenu.hide();
    if (!this.selectOptionsLoaded) {
      this.loadSelectOptions();
    }
    this.editingId.set(course.id);
    this.showEditCourse.set(true);
    this.editLoading.set(true);
    this.editPhotoPreview.set(null);

    // Reset to a sane skeleton in case the previous edit left stale state.
    this.editForm.reset({
      title:         { en: '', ar: '' },
      description:   { en: '', ar: '' },
      type:          'hybrid',
      category_id:   null,
      instructor_id: null,
      hours:         1,
      max_learners:  30,
      certificate:   true,
      active:        true,
      image:         null,
    });

    this.coursesApi.getById(course.id).subscribe({
      next: res => {
        const r = res.result as unknown as ApiCourseRaw;
        const title = this.toLocalized(r.title);
        const desc  = this.toLocalized(r.description);
        const firstInstructor = r.instructors?.[0] ?? r.instructor ?? null;

        this.editForm.patchValue({
          title:         title,
          description:   desc,
          type:          (r.course_type as CourseType) ?? 'hybrid',
          category_id:   r.category?.id ?? null,
          instructor_id: firstInstructor?.id ?? null,
          hours:         r.hours ?? 1,
          max_learners:  r.max_learners ?? 30,
          certificate:   !!r.certificate,
          active:        r.status ? r.status === 'active' : !!r.active,
        });
        // The detail endpoint resolves `image` to a fully-qualified URL via
        // CourseDetailResource — wire it straight into the upload widget so
        // admins can see the current photo before deciding to replace it.
        const existing = (r as { image?: string | null }).image ?? null;
        this.editPhotoPreview.set(existing);
        this.editLoading.set(false);
      },
      error: () => this.editLoading.set(false),
    });
  }

  /** Handle a file pick on the Add Course dialog. Pushes the File into the
   *  reactive form and shows an inline data-URL preview so the swap is
   *  visible immediately. */
  onAddPhotoPicked(file: File): void {
    this.form.patchValue({ image: file });
    this.readPreview(file).then(url => this.addPhotoPreview.set(url));
  }

  onAddPhotoCleared(): void {
    this.form.patchValue({ image: null });
    this.addPhotoPreview.set(null);
  }

  onEditPhotoPicked(file: File): void {
    this.editForm.patchValue({ image: file });
    this.readPreview(file).then(url => this.editPhotoPreview.set(url));
  }

  /** Clearing the photo on the Edit dialog only resets the *pending*
   *  replacement; the existing server-side image stays until a new file
   *  is uploaded (the backend update endpoint has no "remove image" path). */
  onEditPhotoCleared(): void {
    this.editForm.patchValue({ image: null });
    this.editPhotoPreview.set(null);
  }

  private readPreview(file: File): Promise<string> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  /** Normalize the backend's localized field into our bilingual shape. */
  private toLocalized(v: unknown): LocalizedText {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as { en?: string; ar?: string };
      return { en: obj.en ?? '', ar: obj.ar ?? '' };
    }
    const s = typeof v === 'string' ? v : '';
    return { en: s, ar: s };
  }

  submitEditCourse(): void {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    const id = this.editingId();
    if (!id || this.editSaving()) return;

    const v = this.editForm.getRawValue();
    const title = (v.title ?? {}) as LocalizedText;
    const desc  = (v.description ?? {}) as LocalizedText;
    const titleEn = (title.en ?? '').trim();
    const titleAr = (title.ar ?? '').trim();
    const descEn  = (desc.en ?? '').trim();
    const descAr  = (desc.ar ?? '').trim();

    // CourseRequest validates `course_type` ∈ {online, offline}; we keep
    // the 4-way `type` semantically in the UI and map hybrid/external_link
    // down to offline for the persisted column — same convention the
    // detail-page Edit dialog uses.
    const courseType: 'online' | 'offline' = v.type === 'online' ? 'online' : 'offline';

    const fd = new FormData();
    fd.append('_method', 'PUT');
    fd.append('title[en]',       titleEn || titleAr);
    fd.append('title[ar]',       titleAr || titleEn);
    fd.append('description[en]', descEn  || descAr);
    fd.append('description[ar]', descAr  || descEn);
    fd.append('course_type',     courseType);
    fd.append('category_id',     String(v.category_id ?? ''));
    fd.append('instructors[]',   String(v.instructor_id ?? ''));
    fd.append('hours',           String(v.hours ?? 1));
    fd.append('max_learners',    String(v.max_learners ?? 30));
    fd.append('certificate',     v.certificate ? '1' : '0');
    fd.append('active',          v.active ? '1' : '0');
    if (v.image instanceof File) {
      fd.append('image', v.image);
    }

    this.editSaving.set(true);
    // Laravel can't parse multipart payloads on PUT, so we POST with
    // `_method=PUT` to invoke the update controller action.
    this.api.post(`${API.COURSES}/${id}`, fd).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          detail: this.t.instant('courses_list.course_updated'),
        });
        this.editSaving.set(false);
        this.showEditCourse.set(false);
        this.editingId.set(null);
        this.load();
        this.loadTabCounts();
      },
      error: () => this.editSaving.set(false),
    });
  }

  /** Stepper for the "Hours" number input on the Edit dialog. */
  adjustEditHours(delta: number): void {
    const current = Number(this.editForm.value.hours ?? 0);
    const next = Math.max(1, Math.min(10000, current + delta));
    this.editForm.patchValue({ hours: next });
  }

  /** Stepper for the "Max per Cohort" number input on the Edit dialog. */
  adjustEditMaxLearners(delta: number): void {
    const current = Number(this.editForm.value.max_learners ?? 0);
    const next = Math.max(1, Math.min(10000, current + delta));
    this.editForm.patchValue({ max_learners: next });
  }

  /* ── Add Course modal ─────────────────────────────────────────────── */
  openAddCourse(): void {
    this.form.reset({
      title: { en: '', ar: '' }, type: 'hybrid', category_id: null, instructor_id: null,
      certificate: true, require_instructor: true, description: { en: '', ar: '' },
      hours: 1, max_learners: 30, cohort_start: null, cohort_end: null, qualification_ids: [], image: null,
    });
    this.addPhotoPreview.set(null);
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
        this.toast.add({
          severity: 'success',
          detail: this.t.instant('courses_list.course_created'),
        });
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
