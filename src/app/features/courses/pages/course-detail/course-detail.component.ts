import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import {
  NasStatCardComponent,
  NasTabsComponent,
  NasTab,
  NasStatusBadgeComponent,
  NasProgressComponent,
  NasAvatarComponent,
  NasPhotoUploadComponent,
  CohortAttendanceDrawerComponent,
} from '../../../../shared/nas';
import type { NasProgressTone } from '../../../../shared/nas/nas-progress.component';
import type { NasStatusTone } from '../../../../shared/nas/nas-status-badge.component';
import { CoursesApiService } from '../../services/courses-api.service';
import { ApiService } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { API } from '../../../../core/constants/api.constants';
import type {
  CourseDetail, Cohort, CohortPayload, CohortStatus,
  CourseLearner, CourseReview,
  CourseModule, ModuleContentType, ModuleLearnerScope, ModulePayload,
  CourseType,
} from '../../../../core/models/course.types';
import {
  mapApiCourseDetail, mapEnrollmentToLearner, mapApiCohort,
  type ApiCourseRaw, type ApiEnrollmentRaw, type ApiCohortRaw,
} from '../../../../core/utils/course-mapper';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { pickLocalized } from '../../../../core/utils/localized';

export type { CourseDetail, Cohort, CourseLearner, CourseReview };

type DetailTab = 'overview' | 'cohort' | 'learners' | 'content' | 'qualifications' | 'ratings';

/** Multi-select filter chips on the Content tab. `all` is mutually exclusive. */
type ModuleFilter = 'all' | ModuleContentType;

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, ReactiveFormsModule, TranslateModule,
    DatePipe,
    DialogModule, DropdownModule, CalendarModule, InputNumberModule, CheckboxModule,
    OverlayPanelModule, ConfirmDialogModule,
    NasStatCardComponent, NasTabsComponent, NasStatusBadgeComponent, NasProgressComponent, NasAvatarComponent,
    NasPhotoUploadComponent, CohortAttendanceDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-detail.component.html',
  styleUrl: './course-detail.component.scss',
})
export class CourseDetailComponent implements OnInit {
  private readonly coursesApi = inject(CoursesApiService);
  private readonly api        = inject(ApiService);
  private readonly enums      = inject(EnumsService);
  private readonly fb         = inject(FormBuilder);
  private readonly route      = inject(ActivatedRoute);
  private readonly toast      = inject(MessageService);
  private readonly t          = inject(TranslateService);
  private readonly confirm    = inject(ConfirmationService);

  constructor() {
    withLocaleReload(() => {
      const id = this.courseId();
      if (id) this.load(id);
    });
  }

  loading      = signal(true);
  course       = signal<CourseDetail | null>(null);
  courseId     = signal<number | null>(null);
  activeTab    = signal<DetailTab>('overview');
  activeCohort = signal<Cohort | null>(null);

  showCohort     = signal(false);
  cohortEditMode = signal(false);
  saving         = signal(false);

  /* ── Cohort Attendance drawer state ─────────────────────────────────── */
  /**
   * The drawer needs the cohort's `course_sections.id` (NOT the legacy
   * session-as-cohort id). The Cohort mapper exposes it as `section_id`;
   * we store both ids + the optimistic name so the drawer header shows
   * something useful while the API request is in flight.
   */
  showAttendance        = signal(false);
  attendanceCohortId    = signal<number | null>(null);
  attendanceCohortName  = signal<string>('');

  /* ── Edit Course dialog state ─────────────────────────────────────── */
  showEdit          = signal(false);
  editSaving        = signal(false);
  categoryOpts      = signal<Array<{ id: number; name: string }>>([]);
  instructorOpts    = signal<Array<{ id: number; name: string }>>([]);
  /** Cheap-and-cached: only fetched the first time the Edit dialog opens. */
  private lookupsLoaded = false;

  /**
   * Course-type dropdown options — driven by the backend `course_type`
   * enum so labels localize automatically and the option set stays in
   * sync with the validator on the server.
   */
  courseTypeOpts = this.enums.options('course_type');

  editForm = this.fb.group({
    title_en:      ['', [Validators.required, Validators.maxLength(255)]],
    title_ar:      ['', Validators.maxLength(255)],
    description_en:['', Validators.required],
    description_ar:[''],
    type:          [null as number | null, Validators.required],
    category_id:   [null as number | null, Validators.required],
    instructor_id: [null as number | null, Validators.required],
    hours:         [1,  [Validators.required, Validators.min(1)]],
    max_learners:  [30, [Validators.required, Validators.min(1)]],
    certificate:   [true],
    active:        [true],
    image:         [null as File | null],
  });

  /**
   * Preview URL bound to the `nas-photo-upload` widget on the Edit dialog.
   * Starts at the server-side `image` (when present) so admins see the
   * current photo before they decide to replace it.
   */
  editPhotoPreview = signal<string | null>(null);

  sectionOptions = computed(() =>
    (this.course()?.sections ?? []).map(s => ({ id: s.id, name: s.name ?? `Section ${s.id}` })),
  );

  ratingDistributionRows = computed(() => {
    const d = this.course()?.rating_distribution ?? [0, 0, 0, 0, 0];
    const max = Math.max(...d, 1);
    return d.map((v, i) => ({ star: 5 - i, value: v, pct: (v / max) * 100 }));
  });

  ratingLabel = computed(() => {
    const c = this.course();
    return `Rating (${c?.rating_count ?? 0} reviews)`;
  });

  /**
   * Rating as a fixed-1 string. We always render a numeric placeholder
   * ("0.0") instead of an em-dash so the score column keeps the visual
   * weight Figma calls for even before any reviews have come in.
   */
  ratingValue = computed(() => {
    const r = this.course()?.rating;
    return (r && r > 0 ? r : 0).toFixed(1);
  });

  /**
   * Completion percent display. The card always renders a numeric value
   * — even before any lecture progress is recorded — so the stat column
   * keeps the visual weight Figma calls for instead of an em-dash.
   */
  completionLabel = computed(() => {
    const p = this.course()?.completion_percent;
    return `${p ?? 0}%`;
  });

  /** Localized delivery label — looked up from the `course_type` enum. */
  deliveryLabel = computed(() => {
    const code = this.course()?.type;
    if (!code) return '—';
    return this.courseTypeOpts().find(o => o.code === code)?.value ?? '—';
  });

  tabs = computed<NasTab[]>(() => {
    const c = this.course();
    return [
      { id: 'overview',       label: 'Overview' },
      { id: 'cohort',         label: 'Cohort',         count: c?.cohorts?.length ?? c?.cohorts_count ?? 0 },
      { id: 'learners',       label: 'Learners',       count: c?.learners?.length ?? c?.enrolled_count ?? 0 },
      { id: 'content',        label: 'Content' },
      { id: 'qualifications', label: 'Qualifications', count: c?.qualifications?.length ?? 0 },
      { id: 'ratings',        label: 'Ratings',        count: c?.rating_count ?? 0 },
    ];
  });

  /**
   * Cohort dialog form. Bilingual name + capacity + status + dates per
   * Figma 332:9988 (new) and 332:10708 (edit). All non-name fields are
   * nullable so admins can defer a final decision until the cohort is
   * actually scheduled.
   */
  cohortForm = this.fb.group({
    name_en:    ['', [Validators.required, Validators.maxLength(255)]],
    name_ar:    ['', [Validators.required, Validators.maxLength(255)]],
    capacity:   [null as number | null, [Validators.min(1), Validators.max(10000)]],
    status:     [null as number | null],
    start_date: [null as Date | null],
    end_date:   [null as Date | null],
  });

  /** Cohort-status dropdown — driven by the backend `cohort_status` enum. */
  cohortStatusOpts = this.enums.options('cohort_status');

  /* ── Content tab — modules state ──────────────────────────────────── */
  modules            = signal<CourseModule[]>([]);
  modulesLoading     = signal(false);
  /** Active filter chips. Mutating this signal recomputes `filteredModules()`. */
  moduleFilters      = signal<Set<ModuleFilter>>(new Set<ModuleFilter>(['all']));
  showModule         = signal(false);
  moduleEditMode     = signal(false);
  moduleSaving       = signal(false);
  activeModule       = signal<CourseModule | null>(null);
  /** Selected file for `content_type === 'document'` (pending upload UX). */
  moduleFile         = signal<File | null>(null);

  /** Module content-type dropdown — backend `module_content_type` enum. */
  moduleContentTypeOpts = this.enums.options('module_content_type');

  /** Module learner-scope dropdown — backend `module_learner_scope` enum. */
  learnerScopeOpts = this.enums.options('module_learner_scope');

  /** Cohort dropdown options for the Specific-Cohort scope. */
  cohortDropdownOpts = computed(() =>
    (this.course()?.cohorts ?? []).map(c => ({ id: c.id, name: c.name || `Cohort ${c.id}` })),
  );

  moduleForm = this.fb.group({
    title_en:           ['', Validators.required],
    title_ar:           ['', Validators.required],
    content_type:       [null as number | null, Validators.required],
    learner_scope:      [null as number | null, Validators.required],
    session_id:         [null as number | null],
    duration_minutes:   [30 as number | null, [Validators.required, Validators.min(0)]],
    video:              [''],
    instructions_en:    [''],
    instructions_ar:    [''],
    require_completion: [false],
  });

  /**
   * Helper for templates that need to compare a form's enum-id value
   * against a known string code (e.g. "is this module learner_scope ==
   * 'cohort'?"). Returns null when the enum hasn't loaded yet so callers
   * can default safely.
   */
  enumCode(name: Parameters<EnumsService['codeForId']>[0], id: number | null | undefined): string | null {
    if (id === null || id === undefined) return null;
    return this.enums.codeForId(name, id);
  }

  /** Convenience method — find an option's localized `value` from its `code`. */
  enumValueFromCode(name: Parameters<EnumsService['options']>[0], code: string | null | undefined): string {
    if (!code) return '';
    return this.enums.options(name)().find(o => o.code === code)?.value ?? code;
  }

  /** Filtered list — driven by the chip selection. */
  filteredModules = computed(() => {
    const filters = this.moduleFilters();
    const list = this.modules();
    if (filters.has('all') || filters.size === 0) return list;
    return list.filter(m => filters.has(m.content_type));
  });

  /** "12 modules · 310 min estimated learner time" header text. */
  modulesHeader = computed(() => {
    const list = this.modules();
    const totalMin = list.reduce((sum, m) => sum + (m.duration_minutes ?? 0), 0);
    const count = list.length;
    const noun = count === 1 ? 'module' : 'modules';
    return totalMin > 0
      ? `${count} ${noun} · ${totalMin} min estimated learner time`
      : `${count} ${noun}`;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) {
        this.courseId.set(id);
        this.load(id);
      }
    });
  }

  load(id: number): void {
    this.loading.set(true);
    forkJoin({
      course:      this.coursesApi.getById(id),
      // Cohorts now live on `course_sections` directly. Pulling them in
      // the same `forkJoin` as the course + enrollments means the detail
      // page is a single round-trip on load.
      cohorts:     this.coursesApi.listCohorts(id),
      // Pull every enrollment (online + offline) in a single shot. The
      // endpoint paginates, but for the detail page we want the full list
      // so we ask for a generous per_page. Failures don't block the page.
      enrollments: this.coursesApi.listEnrollments(id, { per_page: 200 }),
    }).subscribe({
      next: ({ course, cohorts, enrollments }) => {
        const raw = course.result as unknown as ApiCourseRaw;
        const mapped = mapApiCourseDetail(raw);
        const cohortRows = Array.isArray(cohorts.result)
          ? (cohorts.result as ApiCohortRaw[]).map(mapApiCohort)
          : [];
        const rawLearners = (enrollments.result?.data ?? []) as ApiEnrollmentRaw[];
        const learners = rawLearners.map(mapEnrollmentToLearner);
        this.course.set({
          ...mapped,
          cohorts:        cohortRows,
          cohorts_count:  cohortRows.length || mapped.cohorts_count || 0,
          learners,
          // Prefer the actual list length when the server returned rows,
          // otherwise fall back to the scalar count from the detail resource.
          enrolled_count: learners.length || mapped.enrolled_count || 0,
        });
        this.loading.set(false);
        this.loadModules(id);
      },
      error: () => this.loading.set(false),
    });
  }

  setTab(t: string): void {
    this.activeTab.set(t as DetailTab);
    if (t === 'content') {
      const id = this.courseId();
      if (id && !this.modules().length) this.loadModules(id);
    }
  }

  /* ── Content tab — modules CRUD ───────────────────────────────────── */
  loadModules(courseId: number): void {
    this.modulesLoading.set(true);
    this.coursesApi.listModules(courseId).subscribe({
      next: res => {
        this.modules.set(Array.isArray(res.result) ? res.result : []);
        this.modulesLoading.set(false);
      },
      error: () => this.modulesLoading.set(false),
    });
  }

  /** Toggle a filter chip. `all` is mutually exclusive with the type chips. */
  toggleModuleFilter(filter: ModuleFilter): void {
    const current = new Set(this.moduleFilters());
    if (filter === 'all') {
      this.moduleFilters.set(new Set<ModuleFilter>(['all']));
      return;
    }
    current.delete('all');
    current.has(filter) ? current.delete(filter) : current.add(filter);
    if (current.size === 0) current.add('all');
    this.moduleFilters.set(current);
  }

  isFilterActive(filter: ModuleFilter): boolean {
    return this.moduleFilters().has(filter);
  }

  /** Module title in current locale, defensive against bilingual JSON. */
  moduleTitle(m: CourseModule, locale: 'en' | 'ar' = 'en'): string {
    return pickLocalized(m.title, locale, 'Untitled');
  }

  /** Pretty duration: minutes < 60 → "30 min", otherwise → "2 hrs". */
  moduleDurationLabel(m: CourseModule): string {
    const min = m.duration_minutes ?? 0;
    if (!min) return '';
    if (min % 60 === 0) {
      const hrs = min / 60;
      return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
    }
    if (min >= 60) {
      const hrs = Math.floor(min / 60);
      const mins = min % 60;
      return `${hrs}h ${mins}m`;
    }
    return `${min} min`;
  }

  /** Tone for the content-type chip on the row. */
  moduleChipTone(t: ModuleContentType): 'teal' | 'success' | 'sky' | 'neutral' {
    switch (t) {
      case 'video':    return 'teal';
      case 'article':  return 'success';
      case 'link':     return 'sky';
      case 'document': return 'neutral';
    }
  }

  openAddModule(): void {
    this.moduleEditMode.set(false);
    this.activeModule.set(null);
    this.moduleFile.set(null);
    // Defaults map to the canonical first option per Figma — translate
    // the codes into enum ids the dropdowns are bound to. Returns null
    // if the enum hasn't loaded yet; the user can still pick.
    this.moduleForm.reset({
      title_en: '', title_ar: '',
      content_type:  this.enums.idForCode('module_content_type', 'video'),
      learner_scope: this.enums.idForCode('module_learner_scope', 'all'),
      session_id: null, duration_minutes: 30, video: '',
      instructions_en: '', instructions_ar: '',
      require_completion: false,
    });
    this.showModule.set(true);
  }

  openEditModule(m: CourseModule): void {
    this.moduleEditMode.set(true);
    this.activeModule.set(m);
    this.moduleFile.set(null);
    this.moduleForm.reset({
      title_en:           pickLocalized(m.title, 'en'),
      title_ar:           pickLocalized(m.title, 'ar'),
      content_type:       this.enums.idForCode('module_content_type',  m.content_type),
      learner_scope:      this.enums.idForCode('module_learner_scope', m.learner_scope),
      session_id:         m.session_id ?? null,
      duration_minutes:   m.duration_minutes ?? 30,
      video:              m.video ?? '',
      instructions_en:    pickLocalized(m.instructions, 'en'),
      instructions_ar:    pickLocalized(m.instructions, 'ar'),
      require_completion: m.require_completion,
    });
    this.showModule.set(true);
  }

  /** Local-only file selection for the Document content type. */
  onModuleFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.moduleFile.set(file);
    if (file) this.moduleForm.patchValue({ video: file.name });
  }

  clearModuleFile(): void {
    this.moduleFile.set(null);
    this.moduleForm.patchValue({ video: '' });
  }

  /** Quickly format a selected file for the upload preview row. */
  fileSizeLabel(file: File): string {
    const kb = file.size / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  /**
   * Manual stepper for the "Approximate Duration" input. We render the input
   * as a plain `<input type="number">` so the project-wide rule that hides
   * the native spinners still applies, then drive these chevron buttons from
   * the reactive form. Clamped to the same range as the field's validators.
   */
  adjustDuration(delta: number): void {
    const current = Number(this.moduleForm.value.duration_minutes ?? 0);
    const next = Math.max(0, Math.min(1000, current + delta));
    this.moduleForm.patchValue({ duration_minutes: next });
  }

  submitModule(): void {
    if (this.moduleForm.invalid) { this.moduleForm.markAllAsTouched(); return; }
    const id = this.courseId();
    if (!id) return;

    const v = this.moduleForm.getRawValue();
    // Translate the numeric enum ids back to their string codes — both
    // because the backend storage column is a varchar and because the
    // type-payload (`type: 'file' | 'url'`) is derived from the code.
    const contentTypeCode = this.enums.codeForId('module_content_type',  v.content_type ?? null) as ModuleContentType | null;
    const learnerScopeCode = this.enums.codeForId('module_learner_scope', v.learner_scope ?? null) as ModuleLearnerScope | null;
    if (!contentTypeCode || !learnerScopeCode) return;

    // Document type currently stores the file *name* in `video` until the
    // file-upload pipeline lands. URL-based types send the typed URL directly.
    const videoValue = (v.video ?? '').trim();
    if (!videoValue) {
      this.moduleForm.controls.video.setErrors({ required: true });
      return;
    }

    const body: ModulePayload = {
      title: {
        en: (v.title_en ?? '').trim(),
        ar: (v.title_ar ?? '').trim(),
      },
      instructions: (v.instructions_en || v.instructions_ar)
        ? { en: (v.instructions_en ?? '').trim(), ar: (v.instructions_ar ?? '').trim() }
        : null,
      content_type:       contentTypeCode,
      learner_scope:      learnerScopeCode,
      session_id:         learnerScopeCode === 'cohort' ? v.session_id ?? null : null,
      duration_minutes:   v.duration_minutes ?? null,
      type:               contentTypeCode === 'document' ? 'file' : 'url',
      video:              videoValue,
      require_completion: !!v.require_completion,
    };

    this.moduleSaving.set(true);
    const editing = this.moduleEditMode() && this.activeModule();
    const req$ = editing
      ? this.coursesApi.updateModule(id, this.activeModule()!.id, body)
      : this.coursesApi.createModule(id, body);

    req$.subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          detail: this.t.instant(
            editing ? 'course_detail_toasts.module_updated' : 'course_detail_toasts.module_added',
          ),
        });
        this.moduleSaving.set(false);
        this.showModule.set(false);
        this.loadModules(id);
      },
      error: () => this.moduleSaving.set(false),
    });
  }

  confirmDeleteModule(m: CourseModule, overlay: OverlayPanel): void {
    overlay.hide();
    const id = this.courseId();
    if (!id) return;
    this.confirm.confirm({
      message: this.t.instant('course_detail_toasts.module_delete_message', { name: this.moduleTitle(m) }),
      header:  this.t.instant('course_detail_toasts.module_delete_title'),
      icon:    'pi pi-exclamation-triangle',
      accept: () => {
        this.coursesApi.deleteModule(id, m.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              detail: this.t.instant('course_detail_toasts.module_deleted'),
            });
            this.loadModules(id);
          },
        });
      },
    });
  }

  /** Open the row's overflow menu and remember which module triggered it. */
  openModuleMenu(ev: Event, m: CourseModule, overlay: OverlayPanel): void {
    this.activeModule.set(m);
    overlay.toggle(ev);
  }

  /** "Cohort A · 30 min" subline shown under each module title in tight rows. */
  moduleSubline(m: CourseModule): string {
    const parts: string[] = [];
    const dur = this.moduleDurationLabel(m);
    if (dur) parts.push(dur);
    if (m.learner_scope === 'cohort' && m.session_id) {
      const cohort = (this.course()?.cohorts ?? []).find(c => c.id === m.session_id);
      if (cohort?.name) parts.push(cohort.name);
    }
    return parts.join(' · ');
  }

  /* ── Edit Course dialog ────────────────────────────────────────────── */
  /**
   * Open the inline edit dialog. We lazily fetch the category / instructor
   * lookup lists on the first open so the page-load cost stays cheap.
   */
  openEditCourse(): void {
    const c = this.course();
    if (!c) return;
    if (!this.lookupsLoaded) {
      this.lookupsLoaded = true;
      this.api.get<Array<{ id: number; name: string }>>(API.CATEGORIES_ACTIVE).subscribe({
        next: r => this.categoryOpts.set(Array.isArray(r.result) ? r.result : []),
      });
      this.api.get<Array<{ id: number; name: string }>>(API.INSTRUCTORS_ALL).subscribe({
        next: r => this.instructorOpts.set(Array.isArray(r.result) ? r.result : []),
      });
    }
    this.editForm.reset({
      title_en:       c.title ?? '',
      title_ar:       c.title ?? '',
      description_en: c.description ?? '',
      description_ar: c.description ?? '',
      // The dropdown is bound to the numeric enum id; translate the
      // backend's string `course_type` accordingly. Falls back to the
      // "hybrid" default if the lookup misses (e.g. enum not yet loaded).
      type:           this.enums.idForCode('course_type', c.type ?? null)
                       ?? this.enums.idForCode('course_type', 'hybrid')
                       ?? null,
      category_id:    c.category?.id ?? null,
      instructor_id:  c.instructor?.id ?? c.instructors?.[0]?.id ?? null,
      hours:          1,
      max_learners:   c.max_learners ?? 30,
      certificate:    !!c.certificate,
      active:         c.status === 'active',
      image:          null,
    });
    // Seed the upload widget with whatever photo the server currently has
    // so the dialog opens in "Replace Photo" mode instead of "Add Photo".
    this.editPhotoPreview.set(c.image ?? null);
    this.showEdit.set(true);
  }

  onEditPhotoPicked(file: File): void {
    this.editForm.patchValue({ image: file });
    const reader = new FileReader();
    reader.onload = () => this.editPhotoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  /** Clearing only resets the *pending* replacement; the existing
   *  server-side image stays until a new file is uploaded (the backend
   *  update endpoint has no "remove image" path). */
  onEditPhotoCleared(): void {
    this.editForm.patchValue({ image: null });
    this.editPhotoPreview.set(null);
  }

  submitEditCourse(): void {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    const id = this.courseId();
    if (!id || this.editSaving()) return;

    const v = this.editForm.getRawValue();
    // The dropdown is bound to the numeric enum id; CourseRequest's
    // AcceptsEnumIds trait normalizes it to the string code on the way in.
    const fd = new FormData();
    fd.append('_method', 'PUT');
    fd.append('title[en]',       v.title_en ?? '');
    fd.append('title[ar]',       v.title_ar || (v.title_en ?? ''));
    fd.append('description[en]', v.description_en ?? '');
    fd.append('description[ar]', v.description_ar || (v.description_en ?? ''));
    fd.append('course_type',     String(v.type ?? ''));
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
          detail: this.t.instant('course_detail_toasts.course_updated'),
        });
        this.editSaving.set(false);
        this.showEdit.set(false);
        this.load(id);
      },
      error: () => this.editSaving.set(false),
    });
  }

  /** Stepper for the "Max per Cohort" number input in the Edit dialog. */
  adjustMaxLearners(delta: number): void {
    const current = Number(this.editForm.value.max_learners ?? 0);
    const next = Math.max(1, Math.min(10000, current + delta));
    this.editForm.patchValue({ max_learners: next });
  }

  /** Stepper for the "Hours" number input. */
  adjustHours(delta: number): void {
    const current = Number(this.editForm.value.hours ?? 0);
    const next = Math.max(1, Math.min(10000, current + delta));
    this.editForm.patchValue({ hours: next });
  }

  openAddCohort(): void {
    this.cohortEditMode.set(false);
    this.activeCohort.set(null);
    this.cohortForm.reset({
      name_en: '', name_ar: '',
      capacity: 30, status: null,
      start_date: null, end_date: null,
    });
    this.showCohort.set(true);
  }

  openEditCohort(cohort: Cohort, overlay: OverlayPanel): void {
    overlay.hide();
    this.cohortEditMode.set(true);
    this.activeCohort.set(cohort);
    this.cohortForm.reset({
      // Prefer the dedicated translations from the resource. Fall back
      // to the localized `name` if the backend hasn't shipped the pair
      // yet (older cohorts created before this migration).
      name_en:    cohort.name_en ?? cohort.name ?? '',
      name_ar:    cohort.name_ar ?? cohort.name ?? '',
      capacity:   cohort.capacity ?? null,
      // Translate the stored string `status` into the numeric enum id
      // the dropdown is bound to.
      status:     this.enums.idForCode('cohort_status', cohort.status ?? null),
      start_date: cohort.start_date ? new Date(cohort.start_date) : null,
      end_date:   cohort.end_date   ? new Date(cohort.end_date)   : null,
    });
    this.showCohort.set(true);
  }

  submitCohort(): void {
    if (this.cohortForm.invalid) { this.cohortForm.markAllAsTouched(); return; }
    const id = this.courseId();
    if (!id) return;

    this.saving.set(true);
    const v = this.cohortForm.getRawValue();
    // Translate enum id back to its string code. Cohorts are stored with
    // a string status column, so the API expects the canonical code.
    const statusCode = this.enums.codeForId('cohort_status', v.status ?? null) as CohortStatus | null;
    const body: CohortPayload = {
      name: {
        en: (v.name_en ?? '').trim(),
        ar: (v.name_ar ?? '').trim(),
      },
      start_date: v.start_date ? this.toIso(v.start_date) : null,
      end_date:   v.end_date   ? this.toIso(v.end_date)   : null,
      capacity:   v.capacity ?? null,
      status:     statusCode ?? null,
    };

    const editing = this.cohortEditMode() && this.activeCohort();
    const req = editing
      ? this.coursesApi.updateCohort(id, this.activeCohort()!.id, body)
      : this.coursesApi.createCohort(id, body);

    req.subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          detail: this.t.instant(
            editing ? 'course_detail_toasts.cohort_updated' : 'course_detail_toasts.cohort_created',
          ),
        });
        this.saving.set(false);
        this.showCohort.set(false);
        this.load(id);
      },
      error: () => this.saving.set(false),
    });
  }

  /**
   * Stepper for the Capacity number field. Mirrors `adjustMaxLearners` on
   * the Edit Course dialog so admins get the same up/down chevron UX in
   * both places without dragging in PrimeNG's full p-inputNumber widget.
   */
  adjustCohortCapacity(delta: number): void {
    const current = Number(this.cohortForm.value.capacity ?? 0);
    const next = Math.max(1, Math.min(10000, current + delta));
    this.cohortForm.patchValue({ capacity: next });
  }

  deleteCohort(cohort: Cohort, overlay: OverlayPanel): void {
    overlay.hide();
    const id = this.courseId();
    if (!id) return;
    this.coursesApi.deleteCohort(id, cohort.id).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          detail: this.t.instant('course_detail_toasts.cohort_deleted'),
        });
        this.load(id);
      },
    });
  }

  openCohortMenu(ev: Event, cohort: Cohort, overlay: OverlayPanel): void {
    this.activeCohort.set(cohort);
    overlay.toggle(ev);
  }

  /**
   * Open the right-edge "Attendance Record" drawer for the given cohort.
   * Cohort.id is the same as the `course_sections.id` the attendance
   * endpoint expects, so no extra lookup is needed.
   */
  openCohortAttendance(cohort: Cohort, overlay: OverlayPanel): void {
    overlay.hide();
    this.attendanceCohortId.set(cohort.id);
    this.attendanceCohortName.set(cohort.name || '');
    this.showAttendance.set(true);
  }

  private toIso(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
  }

  statusTone(s: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
    switch (s) {
      case 'completed':
      case 'active':       return 'success';
      case 'pending':
      case 'in_progress':  return 'warning';
      case 'upcoming':     return 'info';
      case 'inactive':
      case 'not_started':  return 'danger';
      default:             return 'neutral';
    }
  }

  /**
   * Friendly label for the learner status pill — driven by the
   * `enrollment_status` backend enum so the wording stays consistent
   * with the rest of the admin UI and re-localizes on Arabic.
   */
  learnerStatusLabel(s: CourseLearner['status']): string {
    return this.enumValueFromCode('enrollment_status', s);
  }

  /**
   * Progress-bar tone — pixel-matched to Figma 321:6791:
   *   - 100%        → success (#0fb86a, bright green)
   *   - 50-99%      → info (#496e91, navy "operational-2")
   *   - 1-49% and 0%→ danger (#f14437, red)
   *
   * The percentage text inherits the same tone via the `tintValue` flag
   * passed to `<nas-progress>` so the colour pairing in the Figma mock
   * stays consistent for the bar and the trailing label.
   */
  learnerProgressTone(p: number): NasProgressTone {
    if (p >= 100) return 'success';
    if (p >= 50)  return 'info';
    return 'danger';
  }

  typeTone(s?: string): 'teal' | 'neutral' | 'success' | 'sky' {
    return s === 'hybrid' ? 'success'
         : s === 'online' ? 'teal'
         : s === 'external_link' ? 'sky'
         : 'neutral';
  }

  /**
   * Map a stored cohort status to its Figma chip label. `scheduled`
   * displays as "Up Coming" whenever the start date is in the future
   * (matches the cohort table mock in node 332:9988); anything else
   * shows the localized label sourced from the `cohort_status` enum.
   */
  cohortStatusLabel(cohort: Cohort): string {
    const s = cohort.status;
    if (s === 'scheduled') {
      const start = cohort.start_date ? new Date(cohort.start_date) : null;
      const isFuture = start instanceof Date && !isNaN(start.getTime()) && start > new Date();
      if (isFuture) return this.t.instant('course_detail.up_coming');
    }
    return this.enumValueFromCode('cohort_status', s);
  }

  /**
   * Resolved capacity for the "Enrolled / Capacity" cell.
   *
   * The Figma cohort table always renders the column as `N / M` (e.g.
   * "8 / 30"), never a bare enrolled count. When a cohort hasn't had its
   * own `capacity` set yet — common for cohorts created before the
   * additive migration landed — we fall back to the course's per-cohort
   * cap (`max_learners`) so the cell stays informative without faking
   * data. The chain is:
   *
   *   1. `cohort.capacity`     (explicit per-cohort override)
   *   2. `course.max_learners` (per-course default)
   *   3. `0`                   (last resort — keeps the slash format)
   *
   * Everything in this chain comes straight from the API; nothing here
   * is hard-coded.
   */
  cohortCapacity(cohort: Cohort): number {
    return cohort.capacity
        ?? this.course()?.max_learners
        ?? 0;
  }

  /** Tone for the cohort status chip — derived the same way as the label. */
  cohortStatusTone(cohort: Cohort): NasStatusTone {
    const s = cohort.status;
    if (s === 'completed' || s === 'active') return 'success';
    if (s === 'inactive') return 'danger';
    // scheduled — Up Coming visually = info, plain Scheduled = neutral
    const start = cohort.start_date ? new Date(cohort.start_date) : null;
    const isFuture = start instanceof Date && !isNaN(start.getTime()) && start > new Date();
    return isFuture ? 'info' : 'neutral';
  }
}

