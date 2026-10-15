import { NasConfirmService } from '../../../../../../shared/nas/nas-confirm-modal/nas-confirm.service';
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
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { NasRichTextComponent } from '../../../../../../shared/nas';
import { NasIconComponent } from '../../../../../../shared/nas/nas-icon/nas-icon.component';
import { CoursesApiService, ModuleUploadError } from '../../../../services/courses-api.service';
import { EnumsService } from '../../../../../../core/services/enums.service';
import { LocaleService } from '../../../../../../core/services/locale.service';
import type {
  CourseContentItem,
  CourseModule,
  ModuleContentType,
  ModulePayload,
  ModuleUploadResult,
} from '../../../../../../core/models/course.types';
import { pickLocalized } from '../../../../../../core/utils/localized';
import { pluralKey } from '../../../../../../core/utils/plural-key';
import { withLocaleReload } from '../../../../../../core/utils/with-locale-reload';
import { ToastService } from '../../../../../../core/services/toast.service';
import { NasCanDirective } from '../../../../../../shared/nas/nas-can/nas-can.directive';
import { LocalDatePipe } from '../../../../../../shared/pipes/local-date.pipe';

/** Multi-select filter chips on the Content tab. `all` is mutually exclusive. */
type ModuleFilter = 'all' | ModuleContentType;

/** Which upload slot: the main (Arabic) file or a document's English one. */
type FileSlot = 'main' | 'en';

/** The attached-file chip: "File Title.pdf · 313 KB". */
interface ModuleFileInfo {
  name: string;
  size: number | null;
  url: string | null;
}

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
  imports: [NasCanDirective, RouterLink, LocalDatePipe, 
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    DialogModule,
    DropdownModule,
    CheckboxModule,
    NasRichTextComponent,
    NasIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-content-tab.component.html',
  styleUrl: './course-content-tab.component.scss',
})
export class CourseContentTabComponent implements OnInit {
  private readonly coursesApi = inject(CoursesApiService);
  private readonly enums = inject(EnumsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);
  private readonly confirmDialog = inject(NasConfirmService);
  private readonly locale = inject(LocaleService).locale;

  readonly courseId = input.required<number>();
  /** The count of modules, quizzes and assignments after each load, for the tab pill. */
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
  /**
   * The list the tab shows: modules, quizzes and assignments in the order they
   * were added (Figma 342:11813, D-109). `modules` still backs the module
   * dialog.
   */
  content = signal<CourseContentItem[]>([]);
  modulesLoading = signal(false);
  /** Active filter chips. Mutating this signal recomputes `filteredModules()`. */
  moduleFilters = signal<Set<ModuleFilter>>(new Set<ModuleFilter>(['all']));
  showModule = signal(false);
  moduleEditMode = signal(false);
  moduleSaving = signal(false);
  activeModule = signal<CourseModule | null>(null);

  /** True while a video/document upload is in flight for the module form. */
  moduleUploading = signal(false);
  /** Upload progress 0..100 of the main / English file (D-111). */
  moduleUploadPercent = signal(0);
  moduleUploadPercentEn = signal(0);
  /** Name of the file currently being uploaded (shown in the progress card). */
  moduleUploadingName = signal<string | null>(null);
  /** Most recent successful upload (fresh file picked in the dialog). */
  moduleUpload = signal<ModuleUploadResult | null>(null);
  /**
   * View model for the attached-file chip — drives the "File Title.mp4 · 313 MB"
   * row. Populated from a fresh upload or, on edit, from the persisted
   * `file_name`/`file_url`. `null` renders the upload dropzone instead.
   */
  moduleFileInfo = signal<ModuleFileInfo | null>(null);

  /**
   * A document's optional English file, uploaded the same way as the main
   * (Arabic) one above. Learners reading in English get it; without it they
   * get the Arabic file.
   */
  moduleUploadingEn = signal(false);
  moduleUploadingNameEn = signal<string | null>(null);
  moduleUploadEn = signal<ModuleUploadResult | null>(null);
  moduleFileInfoEn = signal<ModuleFileInfo | null>(null);

  /** The slot's state for the file-upload template ('main' or 'en'). */
  slotUploading(lang: FileSlot): boolean {
    return lang === 'en' ? this.moduleUploadingEn() : this.moduleUploading();
  }
  slotUploadPercent(lang: FileSlot): number {
    return lang === 'en' ? this.moduleUploadPercentEn() : this.moduleUploadPercent();
  }
  slotUploadingName(lang: FileSlot): string | null {
    return lang === 'en' ? this.moduleUploadingNameEn() : this.moduleUploadingName();
  }
  slotFileInfo(lang: FileSlot): ModuleFileInfo | null {
    return lang === 'en' ? this.moduleFileInfoEn() : this.moduleFileInfo();
  }

  /** Module content-type dropdown — backend `module_content_type` enum. */
  moduleContentTypeOpts = this.enums.options('module_content_type');

  moduleForm = this.fb.group({
    title_en: ['', Validators.required],
    title_ar: ['', Validators.required],
    content_type: [null as number | null, Validators.required],
    duration_minutes: [
      30 as number | null,
      [Validators.required, Validators.min(0)],
    ],
    video: [''],
    // A document's optional English file (stored path).
    video_en: [''],
    // Rich-text HTML body — used only by the "article" content type.
    // `content` is the Arabic (main) text, `content_en` the optional English.
    content: [''],
    content_en: [''],
    instructions_en: [''],
    instructions_ar: [''],
    require_completion: [false],
  });

  /** Longest article body in characters (backend CourseLectureRequest::ARTICLE_MAX). */
  readonly articleMax = 500_000;

  /** The English article field's message after a save attempt, or null. */
  articleEnError(): string | null {
    const control = this.moduleForm.controls.content_en;
    if (!control.touched || !control.errors) return null;
    return control.errors['maxlength'] ? 'course_detail.article_too_long' : null;
  }

  /** The article field's message after a save attempt, or null. */
  articleError(): string | null {
    const control = this.moduleForm.controls.content;
    if (!control.errors || !control.touched) return null;
    if (control.errors['maxlength']) return 'course_detail.article_too_long';
    if (control.errors['required']) return 'course_detail.article_required';
    return null;
  }

  /**
   * Helper for templates that need to compare a form's enum-id value
   * against a known string code (e.g. "is this module content_type ==
   * 'article'?"). Returns null when the enum hasn't loaded yet so callers
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

  /** Filtered list — driven by the chip selection; the type chips are module types. */
  filteredContent = computed(() => {
    const filters = this.moduleFilters();
    const list = this.content();
    if (filters.has('all') || filters.size === 0) return list;
    return list.filter((c) => c.kind === 'lecture' && c.content_type !== null && filters.has(c.content_type));
  });

  /** "12 modules · 310 min estimated learner time" header text (quizzes' time allowed included). */
  modulesHeader = computed(() => {
    const list = this.content();
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
    forkJoin({ modules: this.coursesApi.listModules(courseId), content: this.coursesApi.listContent(courseId) }).subscribe({
      next: ({ modules, content }) => {
        this.modules.set(Array.isArray(modules.result) ? modules.result : []);
        this.content.set(Array.isArray(content.result) ? content.result : []);
        this.modulesLoading.set(false);
        this.countChange.emit(this.content().length);
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

  /** "30 min", "1 hr", "2 hrs", "1 hr 15 min" (Figma 2486:139920), in the UI language. */
  moduleDurationLabel(m: { duration_minutes?: number | null }): string {
    const min = m.duration_minutes ?? 0;
    if (min <= 0) return '';
    if (min < 60) return this.t.instant('course_detail.duration_min', { count: min });
    const hrs = Math.floor(min / 60);
    const hours = this.t.instant(pluralKey('course_detail.duration_hours', hrs, this.locale()), { count: hrs });
    const rest = min % 60;
    return rest ? `${hours} ${this.t.instant('course_detail.duration_min', { count: rest })}` : hours;
  }

  openAddModule(): void {
    this.moduleEditMode.set(false);
    this.activeModule.set(null);
    this.moduleUpload.set(null);
    this.moduleFileInfo.set(null);
    this.moduleUploading.set(false);
    this.resetEnglishFile(null);
    // Defaults map to the canonical first option per Figma — translate
    // the codes into enum ids the dropdowns are bound to. Returns null
    // if the enum hasn't loaded yet; the user can still pick.
    this.moduleForm.reset({
      title_en: '',
      title_ar: '',
      content_type: this.enums.idForCode('module_content_type', 'video'),
      duration_minutes: 30,
      video: '',
      video_en: '',
      content: '',
      content_en: '',
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
    this.resetEnglishFile(m);
    this.moduleForm.reset({
      title_en: pickLocalized(m.title, 'en'),
      title_ar: pickLocalized(m.title, 'ar'),
      content_type: this.enums.idForCode('module_content_type', m.content_type),
      duration_minutes: m.duration_minutes ?? 30,
      video: m.video ?? '',
      video_en: m.video_en ?? '',
      content: m.content ?? '',
      content_en: m.content_en ?? '',
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

  moduleIsDocument(): boolean {
    return (
      this.enumCode(
        'module_content_type',
        this.moduleForm.value.content_type,
      ) === 'document'
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
    this.resetEnglishFile(null);
    this.moduleForm.patchValue({ video: '', video_en: '', content: '', content_en: '' });
    this.moduleForm.controls.video.setErrors(null);
    this.moduleForm.controls.content.setErrors(null);
  }

  /** The English file slot, empty or as the module has it. */
  private resetEnglishFile(m: CourseModule | null): void {
    this.moduleUploadEn.set(null);
    this.moduleUploadingEn.set(false);
    this.moduleUploadingNameEn.set(null);
    this.moduleFileInfoEn.set(
      m && m.content_type === 'document' && m.video_en
        ? { name: m.file_name_en || m.video_en, size: null, url: m.file_url_en ?? null }
        : null,
    );
  }

  /** Upload the picked file immediately, then keep its storage path on the form. */
  onModuleFileSelected(event: Event, lang: FileSlot = 'main'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;

    const id = this.courseId();

    if (lang === 'en') {
      this.moduleUploadingNameEn.set(file.name);
      this.moduleUploadingEn.set(true);
      this.moduleUploadPercentEn.set(0);
      this.coursesApi.uploadModuleFile(id, file, f => this.moduleUploadPercentEn.set(Math.floor(f * 100))).subscribe({
        next: (res) => {
          const r = res.result;
          if (r) {
            this.moduleUploadEn.set(r);
            this.moduleFileInfoEn.set({ name: r.name, size: r.size, url: r.url });
            this.moduleForm.patchValue({ video_en: r.path });
          }
          this.moduleUploadingEn.set(false);
          this.moduleUploadingNameEn.set(null);
        },
        error: (e: unknown) => {
          this.moduleUploadingEn.set(false);
          this.moduleUploadingNameEn.set(null);
          if (e instanceof ModuleUploadError) this.toast.error('course_detail.upload_failed');
        },
      });
      return;
    }

    this.moduleUploadingName.set(file.name);
    this.moduleUploading.set(true);
    this.moduleUploadPercent.set(0);
    this.coursesApi.uploadModuleFile(id, file, f => this.moduleUploadPercent.set(Math.floor(f * 100))).subscribe({
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
      error: (e: unknown) => {
        this.moduleUploading.set(false);
        this.moduleUploadingName.set(null);
        if (e instanceof ModuleUploadError) this.toast.error('course_detail.upload_failed');
      },
    });
  }

  clearModuleFile(lang: FileSlot = 'main'): void {
    if (lang === 'en') {
      this.moduleUploadEn.set(null);
      this.moduleFileInfoEn.set(null);
      this.moduleForm.patchValue({ video_en: '' });
      return;
    }
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
    if (this.moduleUploading() || this.moduleUploadingEn()) return;
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
    if (!contentTypeCode) return;

    // Video/Document store an uploaded file (`video` = storage path, `type` =
    // file); External Link stores a URL in `video`; Article stores rich-text
    // HTML in the dedicated `content` field (`video` stays empty).
    const isFile =
      contentTypeCode === 'video' || contentTypeCode === 'document';
    const isArticle = contentTypeCode === 'article';
    const isDocument = contentTypeCode === 'document';
    const videoValue = (v.video ?? '').trim();
    const contentValue = (v.content ?? '').trim();
    const videoEnValue = (v.video_en ?? '').trim();
    const contentEnValue = (v.content_en ?? '').trim();

    const contentMissing = isArticle
      ? this.isRichTextEmpty(contentValue)
      : !videoValue;
    // NEW2B-5763: the server's article limit, checked here so a long paste
    // gets a field message instead of a failed save.
    if (isArticle && contentValue.length > this.articleMax) {
      this.moduleForm.controls.content.setErrors({ maxlength: true });
      this.moduleForm.markAllAsTouched();
      return;
    }
    if (isArticle && contentEnValue.length > this.articleMax) {
      this.moduleForm.controls.content_en.setErrors({ maxlength: true });
      this.moduleForm.markAllAsTouched();
      return;
    }
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
      duration_minutes: v.duration_minutes ?? null,
      type: isArticle ? 'article' : isFile ? 'file' : 'url',
      video: isArticle ? null : videoValue,
      content: isArticle ? contentValue : null,
      file_name: isFile
        ? (this.moduleUpload()?.name ?? this.activeModule()?.file_name ?? null)
        : null,
      // English versions are optional; learners fall back to the Arabic.
      content_en: isArticle && !this.isRichTextEmpty(contentEnValue) ? contentEnValue : null,
      video_en: isDocument && videoEnValue ? videoEnValue : null,
      file_name_en: isDocument && videoEnValue
        ? (this.moduleUploadEn()?.name ?? this.activeModule()?.file_name_en ?? null)
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
        this.toast.success(this.t.instant(
            editing
              ? 'course_detail_toasts.module_updated'
              : 'course_detail_toasts.module_added',
          ));
        this.moduleSaving.set(false);
        this.showModule.set(false);
        this.loadModules(id);
      },
      error: () => this.moduleSaving.set(false),
    });
  }

  /** The row's Delete button: asks first, then removes the module. */
  confirmDeleteModule(m: CourseModule): void {
    const id = this.courseId();
    void this.confirmDialog.ask({
      title: this.t.instant('course_detail_toasts.module_delete_title'),
      message: this.t.instant('confirm.delete_message_title', { title: this.moduleTitle(m) }),
    }).then(confirmed => {
      if (!confirmed) return;
      this.coursesApi.deleteModule(id, m.id).subscribe({
        next: () => {
          this.toast.success('course_detail_toasts.module_deleted');
          this.loadModules(id);
        },
      });
    });
  }

  /** "30 min" subline shown under each module title in tight rows. */
  moduleSubline(m: { duration_minutes?: number | null }): string {
    return this.moduleDurationLabel(m) ?? '';
  }

  /** The module behind a content row, for its Edit / Delete. */
  moduleOf(item: CourseContentItem): CourseModule | null {
    return item.kind === 'lecture' ? this.modules().find((m) => m.id === item.id) ?? null : null;
  }

  /** Badge text: the module's type, or Quiz / Assignment. */
  kindLabel(item: CourseContentItem): string {
    return item.kind === 'lecture'
      ? this.enumValueFromCode('module_content_type', item.content_type)
      : this.t.instant('course_detail.content_kind.' + item.kind);
  }

  /** Where a quiz or assignment is edited (its own form). */
  editLink(item: CourseContentItem): (string | number)[] {
    return ['/admin', item.kind === 'quiz' ? 'quizzes' : 'assignments', item.id, 'edit'];
  }
}
