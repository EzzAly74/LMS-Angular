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
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, combineLatest, forkJoin, map, takeUntil, startWith } from 'rxjs';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService, PrimeTemplate } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import {
  YesNo,
  dateFromApi,
  dateToApi,
  reorderItems,
  yesNoFromKey,
  yesNoOptions,
  yesNoText,
} from '../../../../core/utils/assessment-question';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasDatepickerComponent } from '../../../../shared/nas/nas-datepicker/nas-datepicker.component';
import { QuizzesApiService } from '../../services/quizzes-api.service';
import { CoursesApiService } from '../../../courses/services/courses-api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import type {
  Quiz,
  QuizCohortScope,
  QuizQuestion,
  QuizQuestionType,
  QuizSavePayload,
  QuizStatus,
  CohortLite,
} from '../../models/quiz.types';

interface CourseOpt { id: number; title: string; }

const filled = (items: string[] | null | undefined): string[] => (items ?? []).map(s => s.trim()).filter(Boolean);

interface QuestionValue {
  type: QuizQuestionType;
  options_en: string[];
  options_ar: string[];
  correct_answer_en: string;
  correct_answer_ar: string;
}

/** Options and answer key as the API stores them, per the Figma shape of each type (D-066). */
function keyFields(q: QuestionValue): Pick<QuizQuestion, 'options_en' | 'options_ar' | 'correct_answer_en' | 'correct_answer_ar'> {
  switch (q.type) {
    case 'mcq':
      return { options_en: filled(q.options_en), options_ar: filled(q.options_ar),
        correct_answer_en: q.correct_answer_en.trim() || null, correct_answer_ar: q.correct_answer_ar.trim() || null };
    case 'yes_no':
      return { options_en: yesNoOptions('en'), options_ar: yesNoOptions('ar'),
        correct_answer_en: q.correct_answer_en || null, correct_answer_ar: q.correct_answer_ar || null };
    case 'reorder': {
      // The items are typed in their correct order, so the order is the key.
      const en = filled(q.options_en);
      const ar = filled(q.options_ar);
      return { options_en: en, options_ar: ar, correct_answer_en: JSON.stringify(en), correct_answer_ar: JSON.stringify(ar) };
    }
    default:
      return { options_en: [], options_ar: [], correct_answer_en: null, correct_answer_ar: null };
  }
}

interface QuestionGroup {
  /** Sent back on save so the question is updated in place (B-133). */
  id: FormControl<number | null>;
  type: FormControl<QuizQuestionType>;
  score: FormControl<number>;
  question_en: FormControl<string>;
  question_ar: FormControl<string>;
  options_en: FormArray<FormControl<string>>;
  options_ar: FormArray<FormControl<string>>;
  correct_answer_en: FormControl<string>;
  correct_answer_ar: FormControl<string>;
  explanation_en: FormControl<string>;
  explanation_ar: FormControl<string>;
}

@Component({
  selector: 'app-quiz-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    DropdownModule,
    PrimeTemplate,
    SkeletonModule,
    ToastModule,
    TranslateModule,
    NasIconComponent,
    NasDatepickerComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-form.component.html',
  styleUrl:    './quiz-form.component.scss',
})
export class QuizFormComponent implements OnInit, OnDestroy {
  private readonly api        = inject(QuizzesApiService);
  private readonly coursesApi = inject(CoursesApiService);
  private readonly enums      = inject(EnumsService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly fb         = inject(FormBuilder);
  private readonly toast      = inject(MessageService);
  private readonly t          = inject(TranslateService);
  private readonly destroy$   = new Subject<void>();

  readonly loading        = signal(true);
  readonly saving         = signal(false);
  readonly courses        = signal<CourseOpt[]>([]);
  readonly cohorts        = signal<CohortLite[]>([]);
  readonly cohortsLoading = signal(false);
  readonly quizId         = signal<number | null>(null);

  /**
   * Cohort-scope dropdown — backend `cohort_scope` enum. Bound to the
   * string `code` so the form control still emits `'all' | 'specific'`
   * (which is what `QuizSavePayload.cohort_scope` is typed as).
   */
  readonly scopeOptions = this.enums.options('cohort_scope');

  /**
   * Question-type dropdown — backend `question_type` enum. Same shape
   * as the others; bound to `code` so the form preserves its string
   * literal type (mcq / yes_no / open / reorder).
   */
  readonly questionTypeOptions = this.enums.options('question_type');

  readonly types = ['pre', 'mid', 'post'] as const;
  readonly langs = ['en', 'ar'] as const;

  /** Yes/No key dropdown (Figma 1982:42127), relabelled on a language switch. */
  readonly yesNoChoices = toSignal(
    combineLatest([this.t.stream('common.yes'), this.t.stream('common.no')]).pipe(
      map(([yes, no]: [string, string]) => [{ value: 'yes' as YesNo, label: yes }, { value: 'no' as YesNo, label: no }]),
    ),
    { initialValue: [] },
  );

  /* ── Form ────────────────────────────────────────────────────── */

  readonly form = this.fb.nonNullable.group({
    title:           ['', [Validators.required, Validators.maxLength(255)]],
    // Figma marks the Arabic title and Type required (D-066).
    title_ar:        ['', [Validators.required, Validators.maxLength(255)]],
    course_id:       this.fb.control<number | null>(null, [Validators.required]),
    cohort_scope:    this.fb.nonNullable.control<QuizCohortScope>('all', [Validators.required]),
    cohort_ids:      this.fb.nonNullable.control<number[]>([]),
    due_date:        this.fb.control<Date | null>(null),
    instructions_en: [''],
    instructions_ar: [''],
    pass_score:      this.fb.control<number | null>(null),
    status:          this.fb.nonNullable.control<QuizStatus>('draft'),
    /** Pre / Mid / Post: exactly one (D-065, D-066); Post is the final exam. */
    type:            this.fb.control<'pre' | 'mid' | 'post' | null>(null, [Validators.required]),
    questions:       this.fb.array<FormGroup<QuestionGroup>>([]),
  });

  get questions(): FormArray<FormGroup<QuestionGroup>> {
    return this.form.controls.questions;
  }

  /* ── Computed summary (right sidebar) ────────────────────────── */

  readonly totalScore    = signal(0);
  readonly questionCount = signal(0);

  constructor() {
    // Refetch the quiz + course catalogue when the UI language changes
    // so titles, instructions and question text come back localized.
    // Also reload cohorts for the currently selected course so the
    // "specific cohort" picker labels follow the new locale (was a
    // gap on the create path with a course preselected).
    withLocaleReload(() => {
      const id = this.quizId();
      if (id) this.fetchQuiz(id);
      this.coursesApi.list({ per_page: 200 }).subscribe({
        next: r => this.courses.set((r.result.data ?? []) as unknown as CourseOpt[]),
      });
      const courseId = this.form.controls.course_id.value;
      if (courseId) this.loadCohorts(courseId);
    });
  }

  /* ── Lifecycle ──────────────────────────────────────────────── */

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : null;
    this.quizId.set(id);

    forkJoin({
      courses: this.coursesApi.list({ per_page: 200 }),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ courses }) => {
        this.courses.set((courses.result.data ?? []) as unknown as CourseOpt[]);

        if (id) {
          this.fetchQuiz(id);
        } else {
          this.addQuestion();
          this.loading.set(false);
        }
      },
      error: () => this.loading.set(false),
    });

    this.questions.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.recomputeTotals());

    // Cohorts belong to a course (B-137): no course, no cohort scope; a
    // new course drops the cohorts picked for the old one.
    this.syncScopeWithCourse(this.form.controls.course_id.value);
    this.form.controls.course_id.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(courseId => {
        this.form.controls.cohort_ids.setValue([]);
        this.syncScopeWithCourse(courseId);
        if (courseId) this.loadCohorts(courseId);
        else this.cohorts.set([]);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Loaders ─────────────────────────────────────────────────── */

  private fetchQuiz(id: number): void {
    this.api.get(id).subscribe({
      next: res => {
        this.populateForm(res.result);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/admin/quizzes']);
      },
    });
  }

  private loadCohorts(courseId: number): void {
    this.cohortsLoading.set(true);
    this.api.cohorts(courseId).subscribe({
      next: res => {
        this.cohorts.set(res.result ?? []);
        this.cohortsLoading.set(false);
      },
      error: () => this.cohortsLoading.set(false),
    });
  }

  private populateForm(q: Quiz): void {
    this.form.patchValue({
      title:           q.title,
      title_ar:        q.title_ar ?? '',
      course_id:       q.course_id,
      cohort_scope:    q.cohort_scope,
      cohort_ids:      q.cohorts.map(c => c.id),
      due_date:        dateFromApi(q.due_date),
      instructions_en: q.instructions_en ?? '',
      instructions_ar: q.instructions_ar ?? '',
      pass_score:      q.pass_score,
      status:          q.status,
      type:            q.type ?? null,
    });

    this.questions.clear();
    for (const question of q.questions ?? []) {
      this.questions.push(this.buildQuestionGroup(question));
    }
    if (!q.questions?.length) this.addQuestion();

    if (q.course_id) this.loadCohorts(q.course_id);
  }

  /* ── Question array management ───────────────────────────────── */

  addQuestion(type: QuizQuestionType = 'mcq'): void {
    this.questions.push(this.buildQuestionGroup({
      type,
      score: 0,
      question_en: '',
      question_ar: '',
      options_en: type === 'mcq' || type === 'reorder' ? ['', ''] : [],
      options_ar: type === 'mcq' || type === 'reorder' ? ['', ''] : [],
      correct_answer_en: '',
      correct_answer_ar: '',
      explanation_en: '',
      explanation_ar: '',
    }));
  }

  removeQuestion(index: number): void {
    this.questions.removeAt(index);
  }

  private syncScopeWithCourse(courseId: number | null): void {
    const scope = this.form.controls.cohort_scope;
    if (courseId) {
      scope.enable({ emitEvent: false });
    } else {
      scope.setValue('all', { emitEvent: false });
      scope.disable({ emitEvent: false });
    }
  }

  stepScore(index: number, delta: 1 | -1): void {
    const ctrl = this.questions.at(index).controls.score;
    ctrl.setValue(Math.max(0, (Number(ctrl.value) || 0) + delta));
    ctrl.markAsDirty();
  }

  yesNo(index: number): YesNo | null {
    return yesNoFromKey(this.questions.at(index).controls.correct_answer_en.value);
  }

  setYesNo(index: number, value: YesNo): void {
    const g = this.questions.at(index).controls;
    g.correct_answer_en.setValue(yesNoText(value, 'en'));
    g.correct_answer_ar.setValue(yesNoText(value, 'ar'));
  }

  showError(ctrl: { invalid: boolean; touched: boolean; dirty: boolean }): boolean {
    return ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }

  changeQuestionType(index: number, type: QuizQuestionType): void {
    const group = this.questions.at(index);
    group.controls.type.setValue(type);

    if (type === 'mcq' || type === 'reorder') {
      if (group.controls.options_en.length === 0) {
        group.controls.options_en.push(this.fb.nonNullable.control(''));
        group.controls.options_en.push(this.fb.nonNullable.control(''));
      }
      if (group.controls.options_ar.length === 0) {
        group.controls.options_ar.push(this.fb.nonNullable.control(''));
        group.controls.options_ar.push(this.fb.nonNullable.control(''));
      }
    } else {
      group.controls.options_en.clear();
      group.controls.options_ar.clear();
    }

    group.controls.correct_answer_en.setValue('');
    group.controls.correct_answer_ar.setValue('');
  }

  addOption(qIndex: number, lang: 'en' | 'ar'): void {
    const arr = lang === 'en'
      ? this.questions.at(qIndex).controls.options_en
      : this.questions.at(qIndex).controls.options_ar;
    arr.push(this.fb.nonNullable.control(''));
  }

  removeOption(qIndex: number, lang: 'en' | 'ar', optIndex: number): void {
    const arr = lang === 'en'
      ? this.questions.at(qIndex).controls.options_en
      : this.questions.at(qIndex).controls.options_ar;
    if (arr.length <= 2) return;
    arr.removeAt(optIndex);
  }

  /* ── Submit ──────────────────────────────────────────────────── */

  /**
   * Reactive bridge from the form to the signals graph.
   *
   * Reactive Forms aren't signal-aware out of the box, so the previous
   * `computed(() => this.form.getRawValue())` ran exactly once on
   * construction (when title was empty + course_id was null) and never
   * re-ran — which is why the Publish button was permanently disabled.
   *
   * `toSignal(valueChanges, { initialValue })` emits the *current* form
   * value into the signal graph, and `startWith` makes sure the signal
   * fires immediately after `populateForm()` runs on edit screens too.
   */
  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  readonly canPublish = computed(() => {
    this.formValue();                       // dependency tracker
    const v = this.form.getRawValue();      // always read the latest, raw value
    // Every field Figma marks with an asterisk (D-066).
    if (!v.title.trim() || !v.title_ar.trim() || !v.course_id || !v.type) return false;
    if (v.cohort_scope === 'specific' && (!v.cohort_ids || v.cohort_ids.length === 0)) return false;
    if (!v.questions.length) return false;
    for (const q of v.questions) {
      if (!q.type || !q.question_en.trim() || !q.question_ar.trim()) return false;
      if (q.type === 'mcq' || q.type === 'reorder') {
        if (filled(q.options_en).length < 2 || filled(q.options_ar).length < 2) return false;
      }
      if (q.type === 'mcq' && (!q.correct_answer_en.trim() || !q.correct_answer_ar.trim())) return false;
      if (q.type === 'yes_no' && !yesNoFromKey(q.correct_answer_en)) return false;
    }
    return true;
  });

  saveDraft(): void {
    this.submit('draft');
  }

  publish(): void {
    if (!this.canPublish()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submit('active');
  }

  private submit(status: QuizStatus): void {
    if (!this.form.valid && status === 'active') {
      this.form.markAllAsTouched();
      return;
    }
    this.form.controls.status.setValue(status);

    const value = this.form.getRawValue();
    const payload: QuizSavePayload = {
      course_id:       value.course_id!,
      title:           value.title.trim(),
      title_ar:        value.title_ar?.trim() || null,
      instructions_en: value.instructions_en?.trim() || null,
      instructions_ar: value.instructions_ar?.trim() || null,
      due_date:        dateToApi(value.due_date),
      cohort_scope:    value.cohort_scope,
      cohort_ids:      value.cohort_scope === 'specific' ? value.cohort_ids : [],
      pass_score:      value.pass_score,
      status,
      type:            value.type,
      questions: value.questions.map(q => ({
        ...(q.id ? { id: q.id } : {}),
        type: q.type,
        score: Number(q.score) || 0,
        question_en: q.question_en.trim(),
        question_ar: q.question_ar.trim() || null,
        ...keyFields(q),
        explanation_en: q.explanation_en || null,
        explanation_ar: q.explanation_ar || null,
      })),
    };

    this.saving.set(true);
    const obs$ = this.quizId()
      ? this.api.update(this.quizId()!, payload)
      : this.api.create(payload);

    obs$.subscribe({
      next: res => {
        this.saving.set(false);
        this.toast.add({
          severity: 'success',
          detail: this.t.instant(this.quizId() ? 'quizzes.toast_updated' : 'quizzes.toast_created'),
        });
        const id = res.result.id;
        if (!this.quizId()) {
          this.router.navigate(['/admin/quizzes', id, 'edit']);
        }
      },
      error: () => this.saving.set(false),
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/quizzes']);
  }

  /* ── Internal helpers ───────────────────────────────────────── */

  private recomputeTotals(): void {
    const qs = this.questions.controls;
    let total = 0;
    for (const g of qs) {
      total += Number(g.controls.score.value) || 0;
    }
    this.totalScore.set(total);
    this.questionCount.set(qs.length);
  }

  private buildQuestionGroup(q: Partial<QuizQuestion>): FormGroup<QuestionGroup> {
    // Reorder items are shown in their correct order: the stored key (D-066).
    const reorder = q.type === 'reorder';
    const itemsEn = reorder ? reorderItems(q.options_en, q.correct_answer_en) : (q.options_en ?? []);
    const itemsAr = reorder ? reorderItems(q.options_ar, q.correct_answer_ar) : (q.options_ar ?? []);
    const optsEn = (q.type === 'yes_no' ? [] : itemsEn).map(o => this.fb.nonNullable.control<string>(o ?? ''));
    const optsAr = (q.type === 'yes_no' ? [] : itemsAr).map(o => this.fb.nonNullable.control<string>(o ?? ''));

    return this.fb.nonNullable.group<QuestionGroup>({
      id:                this.fb.control<number | null>(q.id ?? null),
      type:              this.fb.nonNullable.control<QuizQuestionType>(q.type ?? 'mcq'),
      score:             this.fb.nonNullable.control<number>(q.score ?? 0, { validators: [Validators.min(0)] }),
      question_en:       this.fb.nonNullable.control<string>(q.question_en ?? '', { validators: [Validators.required] }),
      question_ar:       this.fb.nonNullable.control<string>(q.question_ar ?? '', { validators: [Validators.required] }),
      options_en:        this.fb.array<FormControl<string>>(optsEn),
      options_ar:        this.fb.array<FormControl<string>>(optsAr),
      correct_answer_en: this.fb.nonNullable.control<string>(q.correct_answer_en ?? ''),
      correct_answer_ar: this.fb.nonNullable.control<string>(q.correct_answer_ar ?? ''),
      explanation_en:    this.fb.nonNullable.control<string>(q.explanation_en ?? ''),
      explanation_ar:    this.fb.nonNullable.control<string>(q.explanation_ar ?? ''),
    });
  }

  optionsEn(i: number): FormArray<FormControl<string>> { return this.questions.at(i).controls.options_en; }
  optionsAr(i: number): FormArray<FormControl<string>> { return this.questions.at(i).controls.options_ar; }
  questionType(i: number): QuizQuestionType { return this.questions.at(i).controls.type.value; }

  scopeLabel(scope: QuizCohortScope): string {
    const localized = this.enums.options('cohort_scope')().find(o => o.code === scope)?.value;
    if (scope === 'all') return localized ?? 'All cohorts';
    const selectedIds = this.form.controls.cohort_ids.value ?? [];
    if (!selectedIds.length) return localized ?? 'Specific cohort';
    return this.cohorts()
      .filter(c => selectedIds.includes(c.id))
      .map(c => c.title)
      .filter((t): t is string => !!t)
      .join(', ') || (localized ?? 'Specific cohort');
  }

  toggleCohort(id: number): void {
    const ctrl = this.form.controls.cohort_ids;
    const current = ctrl.value ?? [];
    if (current.includes(id)) ctrl.setValue(current.filter(x => x !== id));
    else ctrl.setValue([...current, id]);
  }

  isCohortSelected(id: number): boolean {
    return (this.form.controls.cohort_ids.value ?? []).includes(id);
  }
}
