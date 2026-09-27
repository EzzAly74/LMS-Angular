import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
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
import { CheckboxModule } from 'primeng/checkbox';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { NasStatusBadgeComponent, NasRichTextComponent } from '../../../../../../shared/nas';
import { CoursesApiService } from '../../../../services/courses-api.service';
import { EnumsService } from '../../../../../../core/services/enums.service';
import { LocaleService } from '../../../../../../core/services/locale.service';
import type {
  Cohort,
  CourseModule,
  ModuleContentType,
  ModuleLearnerScope,
  ModulePayload,
  ModuleUploadResult,
} from '../../../../../../core/models/course.types';
import { pickLocalized } from '../../../../../../core/utils/localized';
import { pluralKey } from '../../../../../../core/utils/plural-key';
import { withLocaleReload } from '../../../../../../core/utils/with-locale-reload';

/** Multi-select filter chips on the Content tab. `all` is mutually exclusive. */
type ModuleFilter = 'all' | ModuleContentType;

/**
 * Course Details - Content tab (course modules). Not part of the 2026
 * redesign (D-025): moved out of the course-detail mega-component (DB-15)
 * with its behaviour unchanged. Fixed on the way: module titles followed
 * English whatever the UI language, and the count line and row menu were
 * hard-coded English (D-051).
 */
@Component({
  selector: 'app-course-content-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    DialogModule,
    DropdownModule,
    CheckboxModule,
    OverlayPanelModule,
    ConfirmDialogModule,
    NasStatusBadgeComponent,
    NasRichTextComponent,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-content-tab.component.html',
  styleUrl: './course-content-tab.component.scss',
})
export class CourseContentTabComponent implements OnInit {
  private readonly coursesApi = inject(CoursesApiService);
  private readonly enums = inject(EnumsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly t = inject(TranslateService);
  private readonly confirm = inject(ConfirmationService);
  private readonly locale = inject(LocaleService).locale;

  readonly courseId = input.required<number>();
  /** The course's cohorts, for the Specific-Cohort scope and row sublines. */
  readonly cohorts = input<Cohort[]>([]);
  /** The course's planned session count ("Related to session number" options). */
  readonly numberOfSessions = input<number | null>(null);
  /** The module count after each load, for the tab pill. */
  readonly countChange = output<number>();

  constructor() {
    // Titles are bilingual JSON picked in the template; the count line is
    // re-derived from the locale signal. Re-read to refresh server labels.
    withLocaleReload(() => this.loadModules(this.courseId()));
  }

  ngOnInit(): void {
    this.loadModules(this.courseId());
  }

  /* ── Content tab — modules state ──────────────────────────────────── */
  modules = signal<CourseModule[]>([]);
  modulesLoading = signal(false);
  /** Active filter chips. Mutating this signal recomputes `filteredModules()`. */
  moduleFilters = signal<Set<ModuleFilter>>(new Set<ModuleFilter>(['all']));
  showModule = signal(false);
  moduleEditMode = signal(false);
  moduleSaving = signal(false);
  activeModule = signal<CourseModule | null>(null);

  /** True while a video/document upload is in flight for the module form. */
  moduleUploading = signal(false);
  /** Name of the file currently being uploaded (shown in the progress card). */
  moduleUploadingName = signal<string | null>(null);
  /** Most recent successful upload (fresh file picked in the dialog). */
  moduleUpload = signal<ModuleUploadResult | null>(null);
  /**
   * View model for the attached-file chip — drives the "File Title.mp4 · 313 MB"
   * row. Populated from a fresh upload or, on edit, from the persisted
   * `file_name`/`file_url`. `null` renders the upload dropzone instead.
   */
  moduleFileInfo = signal<{
    name: string;
    size: number | null;
    url: string | null;
  } | null>(null);

  /** Module content-type dropdown — backend `module_content_type` enum. */
  moduleContentTypeOpts = this.enums.options('module_content_type');

  /** Module learner-scope dropdown — backend `module_learner_scope` enum. */
  learnerScopeOpts = this.enums.options('module_learner_scope');

  /** Cohort dropdown options for the Specific-Cohort scope. */
  cohortDropdownOpts = computed(() =>
    this.cohorts().map((c) => ({
      id: c.id,
      name: c.name || `Cohort ${c.id}`,
    })),
  );

  /** "Related to session number" options — 1..N from the course's planned sessions. */
  sessionNumberOptions = computed<number[]>(() => {
    const n = this.numberOfSessions() ?? 0;
    const count = n && n > 0 ? n : 12;
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  moduleForm = this.fb.group({
    title_en: ['', Validators.required],
    title_ar: ['', Validators.required],
    session_number: [null as number | null, Validators.required],
    content_type: [null as number | null, Validators.required],
    learner_scope: [null as number | null, Validators.required],
    session_id: [null as number | null],
    duration_minutes: [
      30 as number | null,
      [Validators.required, Validators.min(0)],
    ],
    video: [''],
    // Rich-text HTML body — used only by the "article" content type.
    content: [''],
    instructions_en: [''],
    instructions_ar: [''],
    require_completion: [false],
  });

  /**
   * Helper for templates that need to compare a form's enum-id value
   * against a known string code (e.g. "is this module learner_scope ==
   * 'cohort'?"). Returns null when the enum hasn't loaded yet so callers
   * can default safely.
   */
  enumCode(
    name: Parameters<EnumsService['codeForId']>[0],
    id: number | null | undefined,
  ): string | null {
    if (id === null || id === undefined) return null;
    return this.enums.codeForId(name, id);
  }

  /** Convenience method — find an option's localized `value` from its `code`. */
  enumValueFromCode(
    name: Parameters<EnumsService['options']>[0],
    code: string | null | undefined,
  ): string {
    if (!code) return '';
    return (
      this.enums
        .options(name)()
        .find((o) => o.code === code)?.value ?? code
    );
  }

  /** Filtered list — driven by the chip selection. */
  filteredModules = computed(() => {
    const filters = this.moduleFilters();
    const list = this.modules();
    if (filters.has('all') || filters.size === 0) return list;
    return list.filter((m) => filters.has(m.content_type));
  });

  /** "12 modules · 310 min estimated learner time" header text. */
  modulesHeader = computed(() => {
    const list = this.modules();
    const totalMin = list.reduce(
      (sum, m) => sum + (m.duration_minutes ?? 0),
      0,
    );
    const count = list.length;
    const modules = this.t.instant(pluralKey('course_detail.modules_count', count, this.locale()), { count });
    return totalMin > 0
      ? `${modules} · ${this.t.instant('course_detail.modules_minutes', { minutes: totalMin })}`
      : modules;
  });

  /* ── Content tab — modules CRUD ───────────────────────────────────── */
  loadModules(courseId: number): void {
    this.modulesLoading.set(true);
    this.coursesApi.listModules(courseId).subscribe({
      next: (res) => {
        this.modules.set(Array.isArray(res.result) ? res.result : []);
        this.modulesLoading.set(false);
        this.countChange.emit(this.modules().length);
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
  moduleTitle(m: CourseModule): string {
    return pickLocalized(m.title, this.locale(), this.t.instant('course_detail.untitled_module'));
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
      case 'video':
        return 'teal';
      case 'article':
        return 'success';
      case 'link':
        return 'sky';
      case 'document':
        return 'neutral';
    }
  }

  openAddModule(): void {
    this.moduleEditMode.set(false);
    this.activeModule.set(null);
    this.moduleUpload.set(null);
    this.moduleFileInfo.set(null);
    this.moduleUploading.set(false);
    // Defaults map to the canonical first option per Figma — translate
    // the codes into enum ids the dropdowns are bound to. Returns null
    // if the enum hasn't loaded yet; the user can still pick.
    this.moduleForm.reset({
      title_en: '',
      title_ar: '',
      session_number: null,
      content_type: this.enums.idForCode('module_content_type', 'video'),
      learner_scope: this.enums.idForCode('module_learner_scope', 'all'),
      session_id: null,
      duration_minutes: 30,
      video: '',
      content: '',
      instructions_en: '',
      instructions_ar: '',
      require_completion: false,
    });
    this.showModule.set(true);
  }

  openEditModule(m: CourseModule): void {
    this.moduleEditMode.set(true);
    this.activeModule.set(m);
    this.moduleUpload.set(null);
    this.moduleUploading.set(false);
    // Re-hydrate the attached-file chip for uploaded video/document modules so
    // the editor shows the existing file (and a way to replace it) instead of
    // an empty dropzone.
    this.moduleFileInfo.set(
      m.type === 'file' && m.video
        ? { name: m.file_name || m.video, size: null, url: m.file_url ?? null }
        : null,
    );
    this.moduleForm.reset({
      title_en: pickLocalized(m.title, 'en'),
      title_ar: pickLocalized(m.title, 'ar'),
      session_number: m.session_number ?? null,
      content_type: this.enums.idForCode('module_content_type', m.content_type),
      learner_scope: this.enums.idForCode(
        'module_learner_scope',
        m.learner_scope,
      ),
      session_id: m.session_id ?? null,
      duration_minutes: m.duration_minutes ?? 30,
      video: m.video ?? '',
      content: m.content ?? '',
      instructions_en: pickLocalized(m.instructions, 'en'),
      instructions_ar: pickLocalized(m.instructions, 'ar'),
      require_completion: m.require_completion,
    });
    this.showModule.set(true);
  }

  /* ── Content-type aware helpers (drive the conditional file/URL field) ─── */

  /** `true` when the chosen content type stores an uploaded file (video/document). */
  moduleIsFileType(): boolean {
    const code = this.enumCode(
      'module_content_type',
      this.moduleForm.value.content_type,
    );
    return code === 'video' || code === 'document';
  }

  moduleIsVideo(): boolean {
    return (
      this.enumCode(
        'module_content_type',
        this.moduleForm.value.content_type,
      ) === 'video'
    );
  }

  moduleIsLink(): boolean {
    return (
      this.enumCode(
        'module_content_type',
        this.moduleForm.value.content_type,
      ) === 'link'
    );
  }

  moduleIsArticle(): boolean {
    return (
      this.enumCode(
        'module_content_type',
        this.moduleForm.value.content_type,
      ) === 'article'
    );
  }

  /** Switching content type clears any previously attached file / URL / body. */
  onModuleContentTypeChange(): void {
    this.moduleUpload.set(null);
    this.moduleFileInfo.set(null);
    this.moduleForm.patchValue({ video: '', content: '' });
    this.moduleForm.controls.video.setErrors(null);
    this.moduleForm.controls.content.setErrors(null);
  }

  /** Upload the picked file immediately, then keep its storage path on the form. */
  onModuleFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;

    const id = this.courseId();

    this.moduleUploadingName.set(file.name);
    this.moduleUploading.set(true);
    this.coursesApi.uploadModuleFile(id, file).subscribe({
      next: (res) => {
        const r = res.result;
        if (r) {
          this.moduleUpload.set(r);
          this.moduleFileInfo.set({ name: r.name, size: r.size, url: r.url });
          this.moduleForm.patchValue({ video: r.path });
          this.moduleForm.controls.video.setErrors(null);
        }
        this.moduleUploading.set(false);
        this.moduleUploadingName.set(null);
      },
      error: () => {
        this.moduleUploading.set(false);
        this.moduleUploadingName.set(null);
      },
    });
  }

  clearModuleFile(): void {
    this.moduleUpload.set(null);
    this.moduleFileInfo.set(null);
    this.moduleForm.patchValue({ video: '' });
  }

  /** Pretty file size from raw bytes for the attached-file chip. */
  fileSizeLabel(bytes: number): string {
    const kb = bytes / 1024;
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

  /** True when the rich-text editor has no meaningful text content. */
  private isRichTextEmpty(html: string): boolean {
    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length === 0;
  }

  submitModule(): void {
    if (this.moduleUploading()) return;
    if (this.moduleForm.invalid) {
      this.moduleForm.markAllAsTouched();
      return;
    }
    const id = this.courseId();

    const v = this.moduleForm.getRawValue();
    // Translate the numeric enum ids back to their string codes — both
    // because the backend storage column is a varchar and because the
    // type-payload (`type: 'file' | 'url'`) is derived from the code.
    const contentTypeCode = this.enums.codeForId(
      'module_content_type',
      v.content_type ?? null,
    ) as ModuleContentType | null;
    const learnerScopeCode = this.enums.codeForId(
      'module_learner_scope',
      v.learner_scope ?? null,
    ) as ModuleLearnerScope | null;
    if (!contentTypeCode || !learnerScopeCode) return;

    // Video/Document store an uploaded file (`video` = storage path, `type` =
    // file); External Link stores a URL in `video`; Article stores rich-text
    // HTML in the dedicated `content` field (`video` stays empty).
    const isFile =
      contentTypeCode === 'video' || contentTypeCode === 'document';
    const isArticle = contentTypeCode === 'article';
    const videoValue = (v.video ?? '').trim();
    const contentValue = (v.content ?? '').trim();

    const contentMissing = isArticle
      ? this.isRichTextEmpty(contentValue)
      : !videoValue;
    if (contentMissing) {
      // Flag the field the admin actually edits for this content type.
      this.moduleForm.controls[isArticle ? 'content' : 'video'].setErrors({
        required: true,
      });
      this.moduleForm.markAllAsTouched();
      return;
    }

    const body: ModulePayload = {
      title: {
        en: (v.title_en ?? '').trim(),
        ar: (v.title_ar ?? '').trim(),
      },
      instructions:
        v.instructions_en || v.instructions_ar
          ? {
              en: (v.instructions_en ?? '').trim(),
              ar: (v.instructions_ar ?? '').trim(),
            }
          : null,
      content_type: contentTypeCode,
      learner_scope: learnerScopeCode,
      session_number: v.session_number ?? null,
      session_id: learnerScopeCode === 'cohort' ? (v.session_id ?? null) : null,
      duration_minutes: v.duration_minutes ?? null,
      type: isArticle ? 'article' : isFile ? 'file' : 'url',
      video: isArticle ? null : videoValue,
      content: isArticle ? contentValue : null,
      file_name: isFile
        ? (this.moduleUpload()?.name ?? this.activeModule()?.file_name ?? null)
        : null,
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
            editing
              ? 'course_detail_toasts.module_updated'
              : 'course_detail_toasts.module_added',
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
    this.confirm.confirm({
      message: this.t.instant('course_detail_toasts.module_delete_message', {
        name: this.moduleTitle(m),
      }),
      header: this.t.instant('course_detail_toasts.module_delete_title'),
      icon: 'pi pi-exclamation-triangle',
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
      const cohort = this.cohorts().find(
        (c) => c.id === m.session_id,
      );
      if (cohort?.name) parts.push(cohort.name);
    }
    return parts.join(' · ');
  }
}
