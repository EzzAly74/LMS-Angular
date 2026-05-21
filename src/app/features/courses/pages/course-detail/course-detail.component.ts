import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
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
} from '../../../../shared/nas';
import { CoursesApiService } from '../../services/courses-api.service';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import type {
  CourseDetail, Cohort, CourseLearner, CourseReview,
  CourseModule, ModuleContentType, ModuleLearnerScope, ModulePayload,
  CourseType,
} from '../../../../core/models/course.types';
import {
  mapApiCourseDetail, mapSessionToCohort, mapEnrollmentToLearner,
  type ApiCourseRaw, type ApiEnrollmentRaw,
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
    DatePipe, TitleCasePipe,
    DialogModule, DropdownModule, CalendarModule, InputNumberModule, CheckboxModule,
    OverlayPanelModule, ConfirmDialogModule,
    NasStatCardComponent, NasTabsComponent, NasStatusBadgeComponent, NasProgressComponent, NasAvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-detail.component.html',
  styleUrl: './course-detail.component.scss',
})
export class CourseDetailComponent implements OnInit {
  private readonly coursesApi = inject(CoursesApiService);
  private readonly api        = inject(ApiService);
  private readonly fb         = inject(FormBuilder);
  private readonly route      = inject(ActivatedRoute);
  private readonly toast      = inject(MessageService);
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

  /* ── Edit Course dialog state ─────────────────────────────────────── */
  showEdit          = signal(false);
  editSaving        = signal(false);
  categoryOpts      = signal<Array<{ id: number; name: string }>>([]);
  instructorOpts    = signal<Array<{ id: number; name: string }>>([]);
  /** Cheap-and-cached: only fetched the first time the Edit dialog opens. */
  private lookupsLoaded = false;

  courseTypeOpts: Array<{ id: CourseType; name: string }> = [
    { id: 'online',        name: 'Online' },
    { id: 'offline',       name: 'Offline' },
    { id: 'hybrid',        name: 'Hybrid' },
    { id: 'external_link', name: 'External Link' },
  ];

  editForm = this.fb.group({
    title_en:      ['', [Validators.required, Validators.maxLength(255)]],
    title_ar:      ['', Validators.maxLength(255)],
    description_en:['', Validators.required],
    description_ar:[''],
    type:          ['hybrid' as CourseType, Validators.required],
    category_id:   [null as number | null, Validators.required],
    instructor_id: [null as number | null, Validators.required],
    hours:         [1,  [Validators.required, Validators.min(1)]],
    max_learners:  [30, [Validators.required, Validators.min(1)]],
    certificate:   [true],
    active:        [true],
  });

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

  /** Completion percent display, falls back to '—' when null. */
  completionLabel = computed(() => {
    const p = this.course()?.completion_percent;
    return p === undefined || p === null ? '—' : `${p}%`;
  });

  /** Human-readable delivery label (Online / Offline / Hybrid / External Link). */
  deliveryLabel = computed(() => {
    const t = this.course()?.type;
    switch (t) {
      case 'online':        return 'Online';
      case 'offline':       return 'Offline';
      case 'hybrid':        return 'Hybrid';
      case 'external_link': return 'External Link';
      default:              return '—';
    }
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

  cohortForm = this.fb.group({
    section_id: [null as number | null, Validators.required],
    name:       ['', Validators.required],
    capacity:   [30, [Validators.required, Validators.min(1)]],
    status:     ['scheduled', Validators.required],
    start_date: [null as Date | null],
    end_date:   [null as Date | null],
    location:   [''],
  });

  cohortStatusOpts = [
    { id: 'scheduled', name: 'Scheduled' },
    { id: 'active',    name: 'Active' },
    { id: 'completed', name: 'Completed' },
    { id: 'inactive',  name: 'Inactive' },
  ];

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

  moduleContentTypeOpts: Array<{ id: ModuleContentType; name: string }> = [
    { id: 'video',    name: 'Video' },
    { id: 'document', name: 'Document' },
    { id: 'article',  name: 'Article' },
    { id: 'link',     name: 'Link' },
  ];

  learnerScopeOpts: Array<{ id: ModuleLearnerScope; name: string }> = [
    { id: 'all',    name: 'All cohort' },
    { id: 'cohort', name: 'Specific Cohort' },
  ];

  /** Cohort dropdown options for the Specific-Cohort scope. */
  cohortDropdownOpts = computed(() =>
    (this.course()?.cohorts ?? []).map(c => ({ id: c.id, name: c.name || `Cohort ${c.id}` })),
  );

  moduleForm = this.fb.group({
    title_en:           ['', Validators.required],
    title_ar:           ['', Validators.required],
    content_type:       ['video' as ModuleContentType, Validators.required],
    learner_scope:      ['all'  as ModuleLearnerScope, Validators.required],
    session_id:         [null as number | null],
    duration_minutes:   [30 as number | null, [Validators.required, Validators.min(0)]],
    video:              [''],
    instructions_en:    [''],
    instructions_ar:    [''],
    require_completion: [false],
  });

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
      sessions:    this.coursesApi.listSessions(id, { per_page: 100 }),
      // Pull every enrollment (online + offline) in a single shot. The
      // endpoint paginates, but for the detail page we want the full list
      // so we ask for a generous per_page. Failures don't block the page.
      enrollments: this.coursesApi.listEnrollments(id, { per_page: 200 }),
    }).subscribe({
      next: ({ course, sessions, enrollments }) => {
        const raw = course.result as unknown as ApiCourseRaw;
        const mapped = mapApiCourseDetail(raw);
        const cohorts = (sessions.result?.data ?? []).map(mapSessionToCohort);
        const rawLearners = (enrollments.result?.data ?? []) as ApiEnrollmentRaw[];
        const learners = rawLearners.map(mapEnrollmentToLearner);
        this.course.set({
          ...mapped,
          cohorts,
          cohorts_count:  cohorts.length || mapped.cohorts_count || 0,
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
    this.moduleForm.reset({
      title_en: '', title_ar: '',
      content_type: 'video', learner_scope: 'all',
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
      content_type:       m.content_type,
      learner_scope:      m.learner_scope,
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
    const contentType = v.content_type as ModuleContentType;

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
      content_type:       contentType,
      learner_scope:      v.learner_scope as ModuleLearnerScope,
      session_id:         v.learner_scope === 'cohort' ? v.session_id ?? null : null,
      duration_minutes:   v.duration_minutes ?? null,
      type:               contentType === 'document' ? 'file' : 'url',
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
        this.toast.add({ severity: 'success', detail: editing ? 'Module updated' : 'Module added' });
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
      message: `Delete module "${this.moduleTitle(m)}"?`,
      header:  'Delete module',
      icon:    'pi pi-exclamation-triangle',
      accept: () => {
        this.coursesApi.deleteModule(id, m.id).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', detail: 'Module deleted' });
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
      type:           c.type ?? 'hybrid',
      category_id:    c.category?.id ?? null,
      instructor_id:  c.instructor?.id ?? c.instructors?.[0]?.id ?? null,
      hours:          1,
      max_learners:   c.max_learners ?? 30,
      certificate:    !!c.certificate,
      active:         c.status === 'active',
    });
    this.showEdit.set(true);
  }

  submitEditCourse(): void {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    const id = this.courseId();
    if (!id || this.editSaving()) return;

    const v = this.editForm.getRawValue();
    // The backend's CourseRequest expects course_type ∈ {online,offline} but
    // we keep the 4-way `type` semantically in the UI. Map hybrid+external
    // down to offline for the persisted column — the resource still emits
    // them on the way out from the legacy `type` mapping.
    const courseType: 'online' | 'offline' = v.type === 'online' ? 'online' : 'offline';

    const fd = new FormData();
    fd.append('_method', 'PUT');
    fd.append('title[en]',       v.title_en ?? '');
    fd.append('title[ar]',       v.title_ar || (v.title_en ?? ''));
    fd.append('description[en]', v.description_en ?? '');
    fd.append('description[ar]', v.description_ar || (v.description_en ?? ''));
    fd.append('course_type',     courseType);
    fd.append('category_id',     String(v.category_id ?? ''));
    fd.append('instructors[]',   String(v.instructor_id ?? ''));
    fd.append('hours',           String(v.hours ?? 1));
    fd.append('max_learners',    String(v.max_learners ?? 30));
    fd.append('certificate',     v.certificate ? '1' : '0');
    fd.append('active',          v.active ? '1' : '0');

    this.editSaving.set(true);
    // Laravel can't parse multipart payloads on PUT, so we POST with
    // `_method=PUT` to invoke the update controller action.
    this.api.post(`${API.COURSES}/${id}`, fd).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', detail: 'Course updated' });
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
    const sections = this.sectionOptions();
    this.cohortEditMode.set(false);
    this.activeCohort.set(null);
    this.cohortForm.reset({
      section_id: sections[0]?.id ?? null,
      name: '', capacity: 30, status: 'scheduled',
      start_date: null, end_date: null, location: '',
    });
    this.showCohort.set(true);
  }

  openEditCohort(cohort: Cohort, overlay: OverlayPanel): void {
    overlay.hide();
    this.cohortEditMode.set(true);
    this.activeCohort.set(cohort);
    this.cohortForm.reset({
      section_id: cohort.section_id ?? this.sectionOptions()[0]?.id ?? null,
      name:       cohort.name,
      capacity:   cohort.capacity,
      status:     cohort.status,
      start_date: cohort.start_date ? new Date(cohort.start_date) : null,
      end_date:   cohort.end_date   ? new Date(cohort.end_date)   : null,
      location:   '',
    });
    this.showCohort.set(true);
  }

  submitCohort(): void {
    if (this.cohortForm.invalid) { this.cohortForm.markAllAsTouched(); return; }
    const id = this.courseId();
    if (!id) return;

    this.saving.set(true);
    const v = this.cohortForm.getRawValue();
    const body = {
      section_id:   v.section_id!,
      title:        v.name!,
      session_date: v.start_date ? this.toIso(v.start_date) : null,
      time_from:    null,
      time_to:      null,
      location:     v.location || null,
    };

    const req = this.cohortEditMode() && this.activeCohort()
      ? this.coursesApi.updateSession(id, this.activeCohort()!.id, body)
      : this.coursesApi.createSession(id, body);

    req.subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          detail: this.cohortEditMode() ? 'Cohort updated' : 'Cohort created',
        });
        this.saving.set(false);
        this.showCohort.set(false);
        this.load(id);
      },
      error: () => this.saving.set(false),
    });
  }

  deleteCohort(cohort: Cohort, overlay: OverlayPanel): void {
    overlay.hide();
    const id = this.courseId();
    if (!id) return;
    this.coursesApi.deleteSession(id, cohort.id).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', detail: 'Cohort deleted' });
        this.load(id);
      },
    });
  }

  openCohortMenu(ev: Event, cohort: Cohort, overlay: OverlayPanel): void {
    this.activeCohort.set(cohort);
    overlay.toggle(ev);
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

  typeTone(s?: string): 'teal' | 'neutral' | 'success' | 'sky' {
    return s === 'hybrid' ? 'success'
         : s === 'online' ? 'teal'
         : s === 'external_link' ? 'sky'
         : 'neutral';
  }

  cohortStatusLabel(s: Cohort['status']): string {
    switch (s) {
      case 'completed': return 'Completed';
      case 'active':    return 'Active';
      case 'upcoming':  return 'Up Coming';
      case 'inactive':  return 'Inactive';
    }
  }
}

