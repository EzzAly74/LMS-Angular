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
import { Subject, forkJoin, takeUntil, startWith } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { NasStatusBadgeComponent } from '../../../../shared/nas';
import { AssignmentsApiService } from '../../services/assignments-api.service';
import { CoursesApiService } from '../../../courses/services/courses-api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import type {
  Assignment,
  AssignmentQuestion,
  AssignmentQuestionType,
  AssignmentSavePayload,
  AssignmentStatus,
  AssignmentCohortScope,
  CohortLite,
} from '../../models/assignment.types';

interface CourseOpt { id: number; title: string; }

interface QuestionGroup {
  type: FormControl<AssignmentQuestionType>;
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
  selector: 'app-assignment-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    DropdownModule,
    SkeletonModule,
    ToastModule,
    TranslateModule,
    NasStatusBadgeComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assignment-form.component.html',
  styleUrl:    './assignment-form.component.scss',
})
export class AssignmentFormComponent implements OnInit, OnDestroy {
  private readonly api        = inject(AssignmentsApiService);
  private readonly coursesApi = inject(CoursesApiService);
  private readonly enums      = inject(EnumsService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly fb         = inject(FormBuilder);
  private readonly toast      = inject(MessageService);
  private readonly destroy$   = new Subject<void>();

  readonly loading      = signal(true);
  readonly saving       = signal(false);
  readonly courses      = signal<CourseOpt[]>([]);
  readonly cohorts      = signal<CohortLite[]>([]);
  readonly cohortsLoading = signal(false);
  readonly assignmentId = signal<number | null>(null);

  /** Cohort-scope dropdown — backend `cohort_scope` enum. */
  readonly scopeOptions = this.enums.options('cohort_scope');

  /** Question-type dropdown — backend `question_type` enum. */
  readonly questionTypeOptions = this.enums.options('question_type');

  /* ── Form ────────────────────────────────────────────────────── */

  readonly form = this.fb.nonNullable.group({
    title:           ['', [Validators.required, Validators.maxLength(255)]],
    title_ar:        ['', [Validators.maxLength(255)]],
    course_id:       this.fb.control<number | null>(null, [Validators.required]),
    cohort_scope:    this.fb.nonNullable.control<AssignmentCohortScope>('all', [Validators.required]),
    cohort_ids:      this.fb.nonNullable.control<number[]>([]),
    due_date:        [''],
    instructions_en: [''],
    instructions_ar: [''],
    pass_score:      this.fb.control<number | null>(null),
    status:          this.fb.nonNullable.control<AssignmentStatus>('draft'),
    questions:       this.fb.array<FormGroup<QuestionGroup>>([]),
  });

  get questions(): FormArray<FormGroup<QuestionGroup>> {
    return this.form.controls.questions;
  }

  /* ── Computed summary (right sidebar) ────────────────────────── */

  readonly totalScore = signal(0);
  readonly questionCount = signal(0);

  constructor() {
    // Refetch the form + lookups whenever the UI locale changes so the
    // server returns localized titles/instructions in the new language.
    // Also reload cohorts for the currently selected course so the
    // "specific cohort" picker labels follow the new locale (was a
    // gap on the create path with a course preselected).
    withLocaleReload(() => {
      const id = this.assignmentId();
      if (id) this.fetchAssignment(id);
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
    this.assignmentId.set(id);

    forkJoin({
      courses: this.coursesApi.list({ per_page: 200 }),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ courses }) => {
        this.courses.set((courses.result.data ?? []) as unknown as CourseOpt[]);

        if (id) {
          this.fetchAssignment(id);
        } else {
          this.addQuestion();
          this.loading.set(false);
        }
      },
      error: () => this.loading.set(false),
    });

    // Recompute totals whenever questions change.
    this.questions.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.recomputeTotals());

    // Reload cohorts when course changes (specific-scope mode).
    this.form.controls.course_id.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(courseId => {
        if (courseId) this.loadCohorts(courseId);
        else this.cohorts.set([]);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Loaders ─────────────────────────────────────────────────── */

  private fetchAssignment(id: number): void {
    this.api.get(id).subscribe({
      next: res => {
        this.populateForm(res.result);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/admin/assignments']);
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

  private populateForm(a: Assignment): void {
    this.form.patchValue({
      title:           a.title,
      title_ar:        a.title_ar ?? '',
      course_id:       a.course_id,
      cohort_scope:    a.cohort_scope,
      cohort_ids:      a.cohorts.map(c => c.id),
      due_date:        a.due_date ?? '',
      instructions_en: a.instructions_en ?? '',
      instructions_ar: a.instructions_ar ?? '',
      pass_score:      a.pass_score,
      status:          a.status,
    });

    this.questions.clear();
    for (const q of a.questions ?? []) {
      this.questions.push(this.buildQuestionGroup(q));
    }
    if (!a.questions?.length) this.addQuestion();

    if (a.course_id) this.loadCohorts(a.course_id);
  }

  /* ── Question array management ───────────────────────────────── */

  addQuestion(type: AssignmentQuestionType = 'mcq'): void {
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
    if (this.questions.length <= 1) return;
    this.questions.removeAt(index);
  }

  changeQuestionType(index: number, type: AssignmentQuestionType): void {
    const group = this.questions.at(index);
    group.controls.type.setValue(type);

    if (type === 'mcq' || type === 'reorder') {
      const needSeedEn = group.controls.options_en.length === 0;
      const needSeedAr = group.controls.options_ar.length === 0;
      if (needSeedEn) {
        group.controls.options_en.push(this.fb.nonNullable.control(''));
        group.controls.options_en.push(this.fb.nonNullable.control(''));
      }
      if (needSeedAr) {
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
    if (!v.title || !v.course_id) return false;
    if (v.cohort_scope === 'specific' && (!v.cohort_ids || v.cohort_ids.length === 0)) return false;
    if (!v.questions.length) return false;
    for (const q of v.questions) {
      if (!q.type || !q.question_en) return false;
      if (q.type !== 'open' && !q.correct_answer_en) return false;
      if ((q.type === 'mcq' || q.type === 'reorder') && (q.options_en?.filter(Boolean).length ?? 0) < 2) return false;
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

  private submit(status: AssignmentStatus): void {
    if (!this.form.valid && status === 'active') {
      this.form.markAllAsTouched();
      return;
    }
    this.form.controls.status.setValue(status);

    const value = this.form.getRawValue();
    const payload: AssignmentSavePayload = {
      course_id:       value.course_id!,
      title:           value.title.trim(),
      title_ar:        value.title_ar?.trim() || null,
      instructions_en: value.instructions_en?.trim() || null,
      instructions_ar: value.instructions_ar?.trim() || null,
      due_date:        value.due_date || null,
      cohort_scope:    value.cohort_scope,
      cohort_ids:      value.cohort_scope === 'specific' ? value.cohort_ids : [],
      pass_score:      value.pass_score,
      status,
      questions: value.questions.map((q: AssignmentQuestion) => ({
        type: q.type,
        score: Number(q.score) || 0,
        question_en: q.question_en,
        question_ar: q.question_ar || null,
        options_en: (q.options_en ?? []).filter(Boolean),
        options_ar: (q.options_ar ?? []).filter(Boolean),
        correct_answer_en: q.correct_answer_en || null,
        correct_answer_ar: q.correct_answer_ar || null,
        explanation_en: q.explanation_en || null,
        explanation_ar: q.explanation_ar || null,
      })),
    };

    this.saving.set(true);
    const obs$ = this.assignmentId()
      ? this.api.update(this.assignmentId()!, payload)
      : this.api.create(payload);

    obs$.subscribe({
      next: res => {
        this.saving.set(false);
        this.toast.add({
          severity: 'success',
          detail: this.assignmentId() ? 'Assignment updated.' : 'Assignment created.',
        });
        const id = res.result.id;
        if (!this.assignmentId()) {
          this.router.navigate(['/admin/assignments', id, 'edit']);
        }
      },
      error: () => this.saving.set(false),
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/assignments']);
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

  private buildQuestionGroup(q: Partial<AssignmentQuestion>): FormGroup<QuestionGroup> {
    const optsEn = (q.options_en ?? []).map(o => this.fb.nonNullable.control<string>(o ?? ''));
    const optsAr = (q.options_ar ?? []).map(o => this.fb.nonNullable.control<string>(o ?? ''));

    return this.fb.nonNullable.group<QuestionGroup>({
      type:              this.fb.nonNullable.control<AssignmentQuestionType>(q.type ?? 'mcq'),
      score:             this.fb.nonNullable.control<number>(q.score ?? 0, { validators: [Validators.min(0)] }),
      question_en:       this.fb.nonNullable.control<string>(q.question_en ?? '', { validators: [Validators.required] }),
      question_ar:       this.fb.nonNullable.control<string>(q.question_ar ?? ''),
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
  questionType(i: number): AssignmentQuestionType { return this.questions.at(i).controls.type.value; }

  scopePillTone(scope: AssignmentCohortScope): 'teal' | 'warning' {
    return scope === 'all' ? 'teal' : 'warning';
  }

  scopeLabel(scope: AssignmentCohortScope): string {
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
