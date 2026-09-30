import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { forkJoin, of, startWith } from 'rxjs';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { EvaluationTemplatesApiService } from '../../services/evaluation-templates-api.service';
import {
  BUILDER_TYPES,
  BuilderOptions,
  BuilderQuestionType,
  EvaluationTemplateDetail,
  EvaluationTemplatePayload,
  SCALE_LABEL_MAX,
  formatScore,
} from '../../models/evaluation.model';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { ToastService } from '../../../../core/services/toast.service';

type LoadState = 'loading' | 'ready' | 'error' | 'not-found' | 'locked';

interface QuestionForm {
  title_en: FormControl<string>;
  title_ar: FormControl<string>;
  type: FormControl<BuilderQuestionType>;
  required: FormControl<boolean>;
  min_en: FormControl<string>;
  min_ar: FormControl<string>;
  max_en: FormControl<string>;
  max_ar: FormControl<string>;
}

interface Option<T> {
  value: T;
  label: string;
}

/** A scale question needs its four end labels; a star question needs none. */
function scaleLabelsRequired(group: AbstractControl): ValidationErrors | null {
  const g = group as FormGroup<QuestionForm>;
  if (g.controls.type.value !== 'scale') return null;
  const missing = (['min_en', 'min_ar', 'max_en', 'max_ar'] as const).filter(k => !g.controls[k].value.trim());
  return missing.length ? { scaleLabels: missing } : null;
}

/**
 * The evaluation template builder - Figma 2409:132793 (all courses, star
 * questions) and 2409:133222 (one course and cohort, scale questions with
 * worded ends) (D4, D-054).
 *
 * "Type of questions" in the General section is the type of every question in
 * the template (D-061, the human's call 2026-09-28; frame 2409:133222 still
 * draws a per-question Type, which is superseded). Each question keeps a
 * `type` control that follows it, so the scale-label rule and the payload stay
 * per question. Publish is enabled only when the whole form is valid - the API
 * validates again.
 *
 * A template any learner has answered cannot be edited (decided by the human
 * 2026-09-26): the edit route shows that instead of a form, and the API refuses
 * the save either way.
 */
@Component({
  selector: 'app-evaluation-template-builder',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule, DropdownModule, SkeletonModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-builder.component.html',
  styleUrl: './template-builder.component.scss',
})
export class EvaluationTemplateBuilderComponent implements OnInit {
  private readonly fb         = inject(NonNullableFormBuilder);
  private readonly api        = inject(EvaluationTemplatesApiService);
  private readonly router     = inject(Router);
  private readonly t          = inject(TranslateService);
  private readonly toast      = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Route param on /:id/edit; absent on /new. */
  readonly id = input<string | undefined>(undefined);
  readonly editing = computed(() => this.id() !== undefined);

  readonly labelMax = SCALE_LABEL_MAX;
  /** The scale end-label fields, "1" and "5", per language. */
  readonly enLabels = [{ key: 'min_en', n: '1' }, { key: 'max_en', n: '5' }] as const;
  readonly arLabels = [{ key: 'min_ar', n: '1' }, { key: 'max_ar', n: '5' }] as const;
  readonly stars    = [1, 2, 3, 4, 5];

  readonly state      = signal<LoadState>('loading');
  readonly options    = signal<BuilderOptions | null>(null);
  readonly existing   = signal<EvaluationTemplateDetail | null>(null);
  readonly saving     = signal(false);
  readonly serverError = signal<string | null>(null);
  /** Shows every field error once Publish has been tried, not before. */
  readonly submitted  = signal(false);

  readonly form = this.fb.group({
    name_en:      this.fb.control('', [Validators.required, Validators.maxLength(191)]),
    name_ar:      this.fb.control('', [Validators.required, Validators.maxLength(191)]),
    course_id:    new FormControl<number | null>(null),
    section_id:   new FormControl<number | null>(null),
    default_type: this.fb.control<BuilderQuestionType>('five'),
    questions:    this.fb.array<FormGroup<QuestionForm>>([], Validators.required),
  });

  get questions(): FormArray<FormGroup<QuestionForm>> {
    return this.form.controls.questions;
  }

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), { initialValue: this.form.getRawValue() });
  private readonly status = toSignal(this.form.statusChanges.pipe(startWith(this.form.status)), { initialValue: this.form.status });

  readonly canPublish = computed(() => this.status() === 'VALID' && !this.saving() && this.state() === 'ready');

  readonly courseOptions = computed<Option<number | null>[]>(() => [
    { value: null, label: this.t.instant('evaluations.builder.all') },
    ...(this.options()?.courses ?? []).map(c => ({ value: c.id, label: c.name ?? '' })),
  ]);

  readonly cohortOptions = computed<Option<number | null>[]>(() => {
    const courseId = this.value().course_id ?? null;
    const course = this.options()?.courses.find(c => c.id === courseId);
    return [
      { value: null, label: this.t.instant('evaluations.builder.all') },
      ...(course?.cohorts ?? []).map(c => ({ value: c.id, label: c.name ?? '' })),
    ];
  });

  readonly typeOptions = computed<Option<BuilderQuestionType>[]>(() =>
    BUILDER_TYPES.map(type => ({ value: type, label: this.t.instant(`evaluations.qtype.${type}`) })),
  );

  /** Publish summary card: scope chips, question count, highest score. */
  readonly scopeCourse = computed(() => {
    const id = this.value().course_id ?? null;
    return id === null ? null : this.options()?.courses.find(c => c.id === id)?.name ?? null;
  });
  readonly scopeCohort = computed(() => {
    const id = this.value().section_id ?? null;
    return id === null ? null : this.cohortOptions().find(o => o.value === id)?.label ?? null;
  });
  readonly questionCount = computed(() => this.value().questions?.length ?? 0);
  readonly highestScore = computed(() => {
    const s = this.existing()?.highest_score;
    return s === null || s === undefined ? null : formatScore(s);
  });
  readonly threshold = computed(() => formatScore(this.options()?.pass_threshold ?? 3));

  constructor() {
    // Course and cohort names come from the API in the page's language; the
    // form the admin is editing is left alone.
    withLocaleReload(() =>
      this.api.options().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: o => this.options.set(o), error: () => undefined }));
  }

  ngOnInit(): void {
    // A cohort only belongs to one course: changing the course clears it.
    this.form.controls.course_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.section_id.setValue(null));

    // One type per template: every question follows "Type of questions".
    this.form.controls.default_type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(type => this.applyType(type));

    const id = this.id();
    forkJoin({ options: this.api.options(), template: id !== undefined ? this.api.get(id) : of(null) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ options, template }) => {
          this.options.set(options);
          if (template === null) {
            this.addQuestion();
            this.state.set('ready');
            return;
          }
          this.existing.set(template);
          if (template.locked) {
            this.state.set('locked');
            return;
          }
          this.fill(template);
          this.state.set('ready');
        },
        error: (e: unknown) => this.state.set(e instanceof HttpErrorResponse && e.status === 404 ? 'not-found' : 'error'),
      });
  }

  addQuestion(): void {
    this.questions.push(this.questionGroup(this.form.controls.default_type.value));
  }

  removeQuestion(i: number): void {
    this.questions.removeAt(i);
  }

  showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted());
  }

  labelMissing(q: FormGroup<QuestionForm>, key: 'min_en' | 'min_ar' | 'max_en' | 'max_ar'): boolean {
    const missing = (q.errors?.['scaleLabels'] as string[] | undefined) ?? [];
    return missing.includes(key) && (q.controls[key].touched || this.submitted());
  }

  publish(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.serverError.set(null);
    const body = this.payload();
    const existing = this.existing();
    const save$ = existing ? this.api.update(existing.id, body) : this.api.create(body);

    save$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.saving.set(false);
        this.toast.success(this.t.instant(existing ? 'evaluations.builder.updated' : 'evaluations.builder.published'));
        void this.router.navigate(['/admin/evaluations', saved.id]);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.serverError.set(this.messageFrom(e));
      },
    });
  }

  // ── Internals ──────────────────────────────────────────────────────────
  private applyType(type: BuilderQuestionType): void {
    for (const q of this.questions.controls) q.controls.type.setValue(type);
  }

  private questionGroup(type: BuilderQuestionType, q?: EvaluationTemplateDetail['questions'][number]): FormGroup<QuestionForm> {
    return this.fb.group<QuestionForm>({
      title_en: this.fb.control(q?.title.en ?? '', [Validators.required, Validators.maxLength(500)]),
      title_ar: this.fb.control(q?.title.ar ?? '', [Validators.required, Validators.maxLength(500)]),
      type:     this.fb.control<BuilderQuestionType>(type),
      required: this.fb.control(q?.required ?? true),
      min_en:   this.fb.control(q?.scale_label_min?.en ?? '', Validators.maxLength(SCALE_LABEL_MAX)),
      min_ar:   this.fb.control(q?.scale_label_min?.ar ?? '', Validators.maxLength(SCALE_LABEL_MAX)),
      max_en:   this.fb.control(q?.scale_label_max?.en ?? '', Validators.maxLength(SCALE_LABEL_MAX)),
      max_ar:   this.fb.control(q?.scale_label_max?.ar ?? '', Validators.maxLength(SCALE_LABEL_MAX)),
    }, { validators: scaleLabelsRequired });
  }

  private fill(t: EvaluationTemplateDetail): void {
    this.form.patchValue({ name_en: t.name.en ?? '', name_ar: t.name.ar ?? '', course_id: t.course?.id ?? null }, { emitEvent: true });
    this.form.controls.section_id.setValue(t.cohort?.id ?? null);
    const builderTypes: readonly string[] = BUILDER_TYPES;
    for (const q of t.questions) {
      // Legacy 1-10 / written questions cannot be recreated in the builder;
      // they open as star questions for the admin to review before saving.
      const type: BuilderQuestionType = builderTypes.includes(q.type) ? (q.type as BuilderQuestionType) : 'five';
      this.questions.push(this.questionGroup(type, q));
    }
    // A template saved before D-061 may mix types; it takes its first
    // question's type, which the admin sees before saving.
    const first = this.questions.at(0)?.controls.type.value;
    if (first) {
      this.form.controls.default_type.setValue(first, { emitEvent: false });
      this.applyType(first);
    }
  }

  private payload(): EvaluationTemplatePayload {
    const v = this.form.getRawValue();
    return {
      name: { en: v.name_en.trim(), ar: v.name_ar.trim() },
      course_id: v.course_id,
      section_id: v.course_id === null ? null : v.section_id,
      questions: v.questions.map(q => ({
        title: { en: q.title_en.trim(), ar: q.title_ar.trim() },
        type: q.type,
        required: q.required,
        scale_label_min: q.type === 'scale' ? { en: q.min_en.trim(), ar: q.min_ar.trim() } : null,
        scale_label_max: q.type === 'scale' ? { en: q.max_en.trim(), ar: q.max_ar.trim() } : null,
      })),
    };
  }

  /** The API's validation messages (already in the request locale), or a generic one. */
  private messageFrom(e: unknown): string {
    if (e instanceof HttpErrorResponse && e.status === 422) {
      const errors = (e.error?.errors ?? {}) as Record<string, string[] | string>;
      const first = Object.values(errors).flatMap(v => (Array.isArray(v) ? v : [v]))[0];
      if (typeof first === 'string') return first;
    }
    return this.t.instant('common.operation_failed');
  }
}
