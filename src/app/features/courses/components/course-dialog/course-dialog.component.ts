import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { forkJoin, map, of, startWith } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { API } from '../../../../core/constants/api.constants';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasPhotoUploadComponent } from '../../../../shared/nas/nas-photo-upload/nas-photo-upload.component';
import {
  CertificateBasis,
  CourseFormSource,
  DEFAULT_THRESHOLD,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  Localized,
  LookupOption,
  POINTS_MAX,
  POINT_MAX,
  TEXT_MAX,
  TITLE_MAX,
} from '../../models/course-form.model';
import { CoursesApiService } from '../../services/courses-api.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

type LoadState = 'loading' | 'ready' | 'error';
type TextField = 'description_en' | 'description_ar' | 'learn_en' | 'learn_ar' | 'requirements_en' | 'requirements_ar';
type FieldKey =
  | 'title_en' | 'title_ar' | 'course_type' | 'category_id' | 'instructor_id' | 'level'
  | 'min_attendance' | 'min_score' | 'image' | TextField | 'qualifications';

let nextId = 0;

/** Lines of a bullet textarea -> the list the API stores (blank lines dropped). */
function points(text: string): string[] {
  return text.split(/\r?\n/).map(l => l.replace(/^\s*[•\-*]\s*/, '').trim()).filter(l => l.length > 0);
}

/** One point per line, each within the server's limits. */
const pointsValidator: ValidatorFn = (c: AbstractControl<string>): ValidationErrors | null => {
  const list = points(c.value ?? '');
  if (list.length > POINTS_MAX) return { tooManyPoints: true };
  if (list.some(p => p.length > POINT_MAX)) return { pointTooLong: true };
  return null;
};

function text(v: Localized | string | null | undefined, locale: 'en' | 'ar'): string {
  if (v && typeof v === 'object') return v[locale] ?? '';
  return typeof v === 'string' ? v : '';
}

/**
 * Add / Edit Course - Figma 2401:126596 (Minimum score) / 2401:126340
 * (Attendance & Minimum score); 2401:125976 shows the Attendance-only state.
 *
 * One modal for Add (course list), Edit (course list row menu) and Edit
 * (Course Details). Edit is not drawn: it is this modal, filled in.
 *
 * Built as drawn, with these deviations (02-figma-map 2.13 update):
 *  - Level is kept beside Instructor (human, 2026-09-27) - the Website badge
 *    and the Website / mobile level filters read it.
 *  - The certificate rules are radios: the three options are exclusive.
 *  - The image accepts PNG / JPG / WEBP / GIF (never SVG, D-044) and has no
 *    ratio hint (human, 2026-09-27: the Website crops to fit).
 *  - "Leave blank to make this course available to all learners" is not
 *    shown: nothing restricts a course by its qualifications.
 * Saving marks the course as issuing a certificate (human, 2026-09-27).
 */
@Component({
  selector: 'app-course-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslateModule, DialogModule, DropdownModule, SkeletonModule,
    NasIconComponent, NasPhotoUploadComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-dialog.component.html',
  styleUrl: './course-dialog.component.scss',
})
export class CourseDialogComponent {
  private readonly api        = inject(ApiService);
  private readonly courses    = inject(CoursesApiService);
  private readonly enums      = inject(EnumsService);
  private readonly fb         = inject(NonNullableFormBuilder);
  private readonly toast      = inject(MessageService);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document   = inject(DOCUMENT);

  readonly visible = model(false);
  /** null = Add New Course. */
  readonly courseId = input<number | null>(null);
  /** Emits the saved course's id. */
  readonly saved = output<number>();

  protected readonly uid = `cd-${nextId++}`;
  protected readonly titleMax = TITLE_MAX;
  protected readonly textMax = TEXT_MAX;
  protected readonly accept = IMAGE_TYPES.join(',');
  protected readonly typeOptions = this.enums.options('course_type');
  protected readonly levelOptions = this.enums.options('course_level');
  protected readonly titleFields = [
    { ctrl: 'title_en', label: 'course_dialog.title_en', dir: 'ltr' },
    { ctrl: 'title_ar', label: 'course_dialog.title_ar', dir: 'rtl' },
  ] as const;
  protected readonly textFields: readonly { ctrl: TextField; label: string; ph: string; dir: 'ltr' | 'rtl'; bullets: boolean }[] = [
    { ctrl: 'description_en', label: 'course_dialog.description_en', ph: 'course_dialog.description_placeholder', dir: 'ltr', bullets: false },
    { ctrl: 'description_ar', label: 'course_dialog.description_ar', ph: 'course_dialog.description_placeholder', dir: 'rtl', bullets: false },
    { ctrl: 'learn_en', label: 'course_dialog.learn_en', ph: 'course_dialog.bullets_placeholder', dir: 'ltr', bullets: true },
    { ctrl: 'learn_ar', label: 'course_dialog.learn_ar', ph: 'course_dialog.bullets_placeholder', dir: 'rtl', bullets: true },
    { ctrl: 'requirements_en', label: 'course_dialog.requirements_en', ph: 'course_dialog.bullets_placeholder', dir: 'ltr', bullets: true },
    { ctrl: 'requirements_ar', label: 'course_dialog.requirements_ar', ph: 'course_dialog.bullets_placeholder', dir: 'rtl', bullets: true },
  ];
  protected readonly rules: readonly { value: CertificateBasis; label: string; help: string }[] = [
    { value: 'attendance', label: 'course_dialog.rule_attendance', help: 'course_dialog.rule_attendance_help' },
    { value: 'score', label: 'course_dialog.rule_score', help: 'course_dialog.rule_score_help' },
    { value: 'both', label: 'course_dialog.rule_both', help: 'course_dialog.rule_both_help' },
  ];

  private readonly threshold = [Validators.required, Validators.min(1), Validators.max(100), Validators.pattern(/^\d+$/)];

  protected readonly form = this.fb.group({
    title_en:        ['', [Validators.required, Validators.maxLength(TITLE_MAX)]],
    title_ar:        ['', [Validators.required, Validators.maxLength(TITLE_MAX)]],
    course_type:     this.fb.control<string | null>(null, Validators.required),
    category_id:     this.fb.control<number | null>(null),
    instructor_id:   this.fb.control<number | null>(null, Validators.required),
    level:           this.fb.control<string | null>(null, Validators.required),
    general_rule:    true,
    rule:            this.fb.control<CertificateBasis>('attendance'),
    min_attendance:  this.fb.control<number | null>(DEFAULT_THRESHOLD, this.threshold),
    min_score:       this.fb.control<number | null>(DEFAULT_THRESHOLD, this.threshold),
    description_en:  ['', Validators.maxLength(TEXT_MAX)],
    description_ar:  ['', Validators.maxLength(TEXT_MAX)],
    learn_en:        ['', pointsValidator],
    learn_ar:        ['', pointsValidator],
    requirements_en: ['', pointsValidator],
    requirements_ar: ['', pointsValidator],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())),
    { requireSync: true },
  );
  private readonly formStatus = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    { initialValue: this.form.status },
  );

  protected readonly state        = signal<LoadState>('ready');
  protected readonly saving       = signal(false);
  protected readonly serverError  = signal<string | null>(null);
  protected readonly fieldErrors  = signal<Partial<Record<FieldKey, string>>>({});
  protected readonly categories   = signal<LookupOption[]>([]);
  protected readonly instructors  = signal<LookupOption[]>([]);
  protected readonly qualifications = signal<LookupOption[]>([]);
  protected readonly lookupsFailed = signal(false);
  protected readonly pickedQualifications = signal<ReadonlySet<number>>(new Set());
  protected readonly image        = signal<File | null>(null);
  protected readonly imagePreview = signal<string | null>(null);
  /** The saved image, shown until a new one is picked. */
  private readonly existingImage  = signal<string | null>(null);
  protected readonly imageTouched = signal(false);

  protected readonly editing = computed(() => this.courseId() !== null);
  protected readonly showsAttendance = computed(() => {
    const v = this.formValue();
    return !v.general_rule && v.rule !== 'score';
  });
  protected readonly showsScore = computed(() => {
    const v = this.formValue();
    return !v.general_rule && v.rule !== 'attendance';
  });
  protected readonly imageMissing = computed(() => !this.editing() && !this.image());
  protected readonly canSubmit = computed(() =>
    this.state() === 'ready' && !this.saving() && this.formStatus() === 'VALID' && !this.imageMissing(),
  );

  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const id = this.courseId();
      untracked(() => this.open(id));
    }, { allowSignalWrites: true });

    // Category / instructor / qualification names are localized: re-read them
    // in the new language without touching what the admin has typed.
    withLocaleReload(() => {
      if (this.visible() && this.state() === 'ready') this.reloadLookups();
    });

    // Thresholds only count while the rule that uses them is chosen.
    this.form.controls.general_rule.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncThresholds());
    this.form.controls.rule.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncThresholds());
  }

  protected setGeneralRule(general: boolean): void {
    this.form.controls.general_rule.setValue(general);
  }

  protected toggleQualification(id: number): void {
    const next = new Set(this.pickedQualifications());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.pickedQualifications.set(next);
  }

  protected onImagePicked(file: File): void {
    this.imageTouched.set(true);
    this.clearFieldError('image');
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      this.fieldErrors.update(e => ({ ...e, image: this.t.instant('course_dialog.image_type') }));
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      this.fieldErrors.update(e => ({ ...e, image: this.t.instant('course_dialog.image_size') }));
      return;
    }
    this.image.set(file);
    const reader = new FileReader();
    reader.onload = () => this.imagePreview.set(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  }

  protected onImageCleared(): void {
    this.image.set(null);
    this.imageTouched.set(true);
    this.clearFieldError('image');
    this.imagePreview.set(this.existingImage());
  }

  protected clearFieldError(name: FieldKey): void {
    if (!this.fieldErrors()[name]) return;
    const { [name]: _gone, ...rest } = this.fieldErrors();
    this.fieldErrors.set(rest);
  }

  protected invalid(name: Exclude<FieldKey, 'image' | 'qualifications'>): boolean {
    const c = this.form.controls[name];
    return (c.invalid && c.touched) || !!this.fieldErrors()[name];
  }

  protected imageInvalid(): boolean {
    return !!this.fieldErrors().image || (this.imageTouched() && this.imageMissing());
  }

  protected errorKey(name: Exclude<FieldKey, 'image' | 'qualifications'>): { key: string; params?: Record<string, number> } {
    const e = this.form.controls[name].errors ?? {};
    if (e['required']) return { key: 'errors.required' };
    if (e['maxlength']) return { key: 'errors.max_length', params: { max: e['maxlength'].requiredLength } };
    if (e['min'] || e['max'] || e['pattern']) return { key: 'course_dialog.threshold_range' };
    if (e['tooManyPoints']) return { key: 'course_dialog.too_many_points', params: { max: POINTS_MAX } };
    if (e['pointTooLong']) return { key: 'course_dialog.point_too_long', params: { max: POINT_MAX } };
    return { key: 'errors.required' };
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    this.imageTouched.set(true);
    if (!this.canSubmit()) {
      this.focusFirstInvalid();
      return;
    }

    const id = this.courseId();
    const body = this.payload();
    this.saving.set(true);
    this.serverError.set(null);
    this.fieldErrors.set({});
    (id === null ? this.courses.create(body) : this.courses.updateMultipart(id, body))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.saving.set(false);
          this.toast.add({
            severity: 'success',
            summary: this.t.instant('common.success_title'),
            detail: this.t.instant(id === null ? 'course_dialog.created' : 'course_dialog.saved'),
          });
          this.saved.emit(res.result?.id ?? id ?? 0);
          this.visible.set(false);
        },
        error: (e: unknown) => {
          this.saving.set(false);
          this.showError(e);
        },
      });
  }

  protected close(): void {
    if (!this.saving()) this.visible.set(false);
  }

  protected restoreFocus(): void {
    this.opener?.focus();
    this.opener = null;
  }

  protected retry(): void {
    this.open(this.courseId());
  }

  private payload(): FormData {
    const v = this.form.getRawValue();
    const fd = new FormData();
    fd.append('title[en]', v.title_en.trim());
    fd.append('title[ar]', v.title_ar.trim());
    fd.append('description[en]', v.description_en.trim());
    fd.append('description[ar]', v.description_ar.trim());
    fd.append('course_type', v.course_type ?? '');
    fd.append('level', v.level ?? '');
    if (v.category_id !== null) fd.append('category_id', String(v.category_id));
    fd.append('instructors[]', String(v.instructor_id ?? ''));
    // JSON so an emptied list survives multipart and is saved as empty.
    fd.append('what_students_will_learn', JSON.stringify({ en: points(v.learn_en), ar: points(v.learn_ar) }));
    fd.append('requirements', JSON.stringify({ en: points(v.requirements_en), ar: points(v.requirements_ar) }));
    fd.append('certificate', '1');
    fd.append('certificate_rule', v.general_rule ? 'general' : v.rule);
    if (!v.general_rule && v.rule !== 'score') fd.append('certificate_min_attendance', String(v.min_attendance));
    if (!v.general_rule && v.rule !== 'attendance') fd.append('certificate_min_score', String(v.min_score));
    // An empty list is sent as one blank entry so an edit can clear it.
    const quals = [...this.pickedQualifications()];
    if (quals.length) quals.forEach(q => fd.append('qualification_skill_ids[]', String(q)));
    else if (this.editing()) fd.append('qualification_skill_ids', '');
    const file = this.image();
    if (file) fd.append('image', file);
    return fd;
  }

  private open(id: number | null): void {
    const active = this.document.activeElement;
    this.opener ??= active instanceof HTMLElement ? active : null;
    // Figma draws Type empty ("Select Type"); nothing is pre-chosen.
    this.form.reset();
    this.syncThresholds();
    this.serverError.set(null);
    this.fieldErrors.set({});
    this.pickedQualifications.set(new Set());
    this.image.set(null);
    this.imagePreview.set(null);
    this.existingImage.set(null);
    this.imageTouched.set(false);
    this.state.set('loading');

    const lookups = forkJoin({
      categories: this.api.get<LookupOption[]>(API.CATEGORIES_ACTIVE),
      instructors: this.api.get<LookupOption[]>(API.INSTRUCTORS_ALL),
      qualifications: this.api.get<LookupOption[]>(API.QUALIFICATIONS_ACTIVE),
    });
    const course = id === null ? of(null) : this.courses.getForForm(id).pipe(map(r => r.result ?? null));

    forkJoin({ lookups, course })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ lookups: l, course: detail }) => {
          this.categories.set(l.categories.result ?? []);
          this.instructors.set(l.instructors.result ?? []);
          this.qualifications.set(l.qualifications.result ?? []);
          if (detail) this.fill(detail);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }

  private reloadLookups(): void {
    forkJoin({
      categories: this.api.get<LookupOption[]>(API.CATEGORIES_ACTIVE),
      instructors: this.api.get<LookupOption[]>(API.INSTRUCTORS_ALL),
      qualifications: this.api.get<LookupOption[]>(API.QUALIFICATIONS_ACTIVE),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: l => {
          this.categories.set(l.categories.result ?? []);
          this.instructors.set(l.instructors.result ?? []);
          this.qualifications.set(l.qualifications.result ?? []);
        },
        error: () => undefined,
      });
  }

  private fill(d: CourseFormSource): void {
    const rule = d.certificate_rule ?? 'general';
    this.form.reset({
      title_en: text(d.title, 'en'),
      title_ar: text(d.title, 'ar'),
      course_type: d.course_type,
      category_id: d.category?.id ?? null,
      instructor_id: d.instructors?.[0]?.id ?? null,
      level: d.level,
      general_rule: rule === 'general',
      rule: rule === 'general' ? 'attendance' : rule,
      min_attendance: d.certificate_min_attendance ?? DEFAULT_THRESHOLD,
      min_score: d.certificate_min_score ?? DEFAULT_THRESHOLD,
      description_en: text(d.description, 'en'),
      description_ar: text(d.description, 'ar'),
      learn_en: (d.what_students_will_learn?.en ?? []).join('\n'),
      learn_ar: (d.what_students_will_learn?.ar ?? []).join('\n'),
      requirements_en: (d.requirements?.en ?? []).join('\n'),
      requirements_ar: (d.requirements?.ar ?? []).join('\n'),
    });
    this.syncThresholds();
    this.pickedQualifications.set(new Set((d.qualification_skills ?? []).map(q => q.id)));
    this.existingImage.set(d.image);
    this.imagePreview.set(d.image);
  }

  private syncThresholds(): void {
    const { general_rule, rule } = this.form.getRawValue();
    const setOn = (c: AbstractControl, on: boolean) => {
      if (on && c.disabled) c.enable({ emitEvent: false });
      if (!on && c.enabled) c.disable({ emitEvent: false });
    };
    setOn(this.form.controls.min_attendance, !general_rule && rule !== 'score');
    setOn(this.form.controls.min_score, !general_rule && rule !== 'attendance');
    this.form.updateValueAndValidity();
  }

  private focusFirstInvalid(): void {
    const root = this.document.getElementById(this.uid);
    const target = root?.querySelector<HTMLElement>('[aria-invalid="true"], .ng-invalid.ng-touched input, input.ng-invalid');
    target?.focus();
  }

  /** A 422 goes next to its field; anything else to the alert above the footer. */
  private showError(e: unknown): void {
    if (e instanceof HttpErrorResponse && e.status === 422) {
      const errors = (e.error?.errors ?? {}) as Record<string, string[]>;
      const map: Record<string, FieldKey> = {
        'title.en': 'title_en', 'title.ar': 'title_ar', course_type: 'course_type', category_id: 'category_id',
        instructors: 'instructor_id', level: 'level', image: 'image',
        certificate_min_attendance: 'min_attendance', certificate_min_score: 'min_score',
        'description.en': 'description_en', 'description.ar': 'description_ar',
        'what_students_will_learn.en': 'learn_en', 'what_students_will_learn.ar': 'learn_ar',
        'requirements.en': 'requirements_en', 'requirements.ar': 'requirements_ar',
        qualification_skill_ids: 'qualifications',
      };
      const fields: Partial<Record<FieldKey, string>> = {};
      let other: string | null = null;
      for (const [key, messages] of Object.entries(errors)) {
        const base = key.replace(/\.\d+$/, '');
        const field = map[key] ?? map[base];
        if (field && !fields[field]) fields[field] = messages[0];
        else if (!field && !other) other = messages[0];
      }
      this.fieldErrors.set(fields);
      this.serverError.set(other);
      return;
    }
    this.serverError.set(this.t.instant('common.operation_failed'));
  }
}
