import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { EMPTY, catchError, concatMap, exhaustMap, finalize, from, map, of, switchMap, timer } from 'rxjs';
import { LocaleService } from '../../../../core/services/locale.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { NasConfirmService } from '../../../../shared/nas/nas-confirm-modal/nas-confirm.service';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasListStateComponent } from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { NasStatusBadgeComponent, type NasStatusTone } from '../../../../shared/nas/nas-status-badge/nas-status-badge.component';
import { AiQuestionEditorComponent } from '../../components/question-editor/question-editor.component';
import {
  ASSESSMENT_TYPES, BLOOM_LEVELS, CONTENT_LANGUAGES, DIFFICULTIES, LIMITS, OPTION_LETTERS, QUESTION_TYPES, usesIndexes,
  type AiAssessment, type AiQuestion, type AiQuestionPayload, type AiSource, type AiUsage, type AssessmentDifficulty,
  type AssessmentType, type BloomLevel, type ContentLanguage, type ExportFormat, type ExportVariant, type IdTitle,
  type MatchingPair, type QuestionCounts, type QuestionStatus, type QuestionType,
} from '../../models/ai-assessment.model';
import { AiActionError, AiAssessmentsApiService } from '../../services/ai-assessments-api.service';
import { fileSize, questionTone, statusTone } from '../../utils/ai-assessment-labels';

export type EditorStep = 'details' | 'sources' | 'configure' | 'review';
const STEPS: readonly EditorStep[] = ['details', 'sources', 'configure', 'review'];

/** How often a generating assessment is re-read (questions appear type by type). */
const POLL_MS = 2500;

const ACCEPTED = ['pdf', 'docx', 'pptx'] as const;

interface DetailsForm {
  title: FormControl<string>;
  type: FormControl<AssessmentType>;
  content_language: FormControl<ContentLanguage>;
  audience: FormControl<string>;
  course_id: FormControl<number | null>;
}

interface ConfigureForm {
  difficulty: FormControl<AssessmentDifficulty>;
  objectives: FormControl<string>;
  bloom: FormGroup<Record<BloomLevel, FormControl<boolean>>>;
  counts: FormGroup<Record<QuestionType, FormControl<number>>>;
}

interface UploadItem {
  readonly key: number;
  readonly name: string;
  state: 'waiting' | 'uploading' | 'done' | 'error';
  error: string | null;
}

/**
 * One AI assessment, as a wizard on a single route (spec §2):
 * Details → Sources → Configure → Review (generate, edit, reorder) → Export.
 * `/new` shows Details only; saving it creates the assessment.
 */
@Component({
  selector: 'app-ai-assessment-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, TranslateModule, DialogModule, DropdownModule, CdkDropList, CdkDrag, CdkDragHandle,
    NasIconComponent, NasListStateComponent, NasStatusBadgeComponent, AiQuestionEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-assessment-editor.component.html',
  styleUrl: './ai-assessment-editor.component.scss',
})
export class AiAssessmentEditorComponent implements OnInit {
  private readonly api = inject(AiAssessmentsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly t = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(NasConfirmService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale = inject(LocaleService).locale;

  readonly steps = STEPS;
  readonly types = ASSESSMENT_TYPES;
  readonly languages = CONTENT_LANGUAGES;
  readonly difficulties = DIFFICULTIES;
  readonly blooms = BLOOM_LEVELS;
  readonly questionTypes = QUESTION_TYPES;
  readonly limits = LIMITS;
  readonly accept = ACCEPTED.map(e => `.${e}`).join(',');
  readonly exportFormats: readonly ExportFormat[] = ['docx', 'pdf', 'xlsx'];
  readonly exportVariants: readonly ExportVariant[] = ['trainer', 'learner'];

  /* ── state ─────────────────────────────────────────────────────── */
  readonly assessment = signal<AiAssessment | null>(null);
  readonly loadState = signal<'loading' | 'ready' | 'error' | 'new'>('loading');
  readonly step = signal<EditorStep>('details');
  readonly saving = signal(false);
  readonly usage = signal<AiUsage | null>(null);
  readonly courses = signal<IdTitle[]>([]);
  readonly generating = computed(() => this.assessment()?.status === 'generating');
  readonly starting = signal(false);
  readonly generationError = signal<string | null>(null);

  readonly uploads = signal<UploadItem[]>([]);
  readonly dragOver = signal(false);
  readonly pasteError = signal<string | null>(null);
  readonly pasting = signal(false);

  readonly editingId = signal<number | null>(null);
  readonly questionBusy = signal<number | null>(null);
  readonly questionError = signal<string | null>(null);
  /** Polite live-region text for screen readers (reorder, generation progress). */
  readonly announcement = signal('');

  readonly exportOpen = signal(false);
  readonly exportFormat = signal<ExportFormat>('docx');
  readonly exportVariant = signal<ExportVariant>('trainer');
  readonly exporting = signal(false);
  readonly exportError = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.canDo('ai-assessments', this.assessment() ? 'edit' : 'create'));
  readonly isNew = computed(() => this.loadState() === 'new');
  readonly questions = computed(() => this.assessment()?.questions ?? []);
  readonly sources = computed(() => this.assessment()?.sources ?? []);
  readonly letters = computed(() => OPTION_LETTERS[this.assessment()?.content_language ?? 'en']);
  readonly contentDir = computed(() => (this.assessment()?.content_language === 'ar' ? 'rtl' : 'ltr'));
  readonly reviewCounts = computed(() => {
    const qs = this.questions();
    return {
      approved: qs.filter(q => q.status === 'approved').length,
      flagged: qs.filter(q => q.status === 'flagged').length,
      total: qs.length,
    };
  });
  readonly canGenerate = computed(() => {
    const a = this.assessment();
    const u = this.usage();
    return !!a && a.sources.length > 0 && this.configuredTotal(a.question_counts) > 0 && !this.generating()
      && !!u?.configured && u.used < u.limit;
  });
  /** Why Generate is disabled, as an i18n key (null when it is enabled). */
  readonly generateBlocker = computed<string | null>(() => {
    const a = this.assessment();
    const u = this.usage();
    if (!a) return null;
    if (u && !u.configured) return 'ai_assessments.blocker_not_configured';
    if (!a.sources.length) return 'ai_assessments.blocker_sources';
    if (this.configuredTotal(a.question_counts) === 0) return 'ai_assessments.blocker_counts';
    if (u && u.used >= u.limit) return 'ai_assessments.blocker_limit';
    return null;
  });

  /* ── forms ─────────────────────────────────────────────────────── */
  readonly details: FormGroup<DetailsForm> = this.fb.group({
    title: this.fb.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]),
    type: this.fb.control<AssessmentType>('pre'),
    content_language: this.fb.control<ContentLanguage>(this.locale() === 'ar' ? 'ar' : 'en'),
    audience: this.fb.control('', Validators.maxLength(150)),
    course_id: new FormControl<number | null>(null),
  });

  readonly configure: FormGroup<ConfigureForm> = this.fb.group({
    difficulty: this.fb.control<AssessmentDifficulty>('mixed'),
    objectives: this.fb.control('', Validators.maxLength(4000)),
    bloom: this.fb.group(Object.fromEntries(BLOOM_LEVELS.map(b => [b, this.fb.control(false)])) as Record<BloomLevel, FormControl<boolean>>),
    counts: this.fb.group(Object.fromEntries(QUESTION_TYPES.map(q => [q, this.fb.control(0, [Validators.min(0), Validators.max(LIMITS.perType)])])) as Record<QuestionType, FormControl<number>>),
  });

  readonly pasteForm = this.fb.group({
    label: this.fb.control('', Validators.maxLength(120)),
    text: this.fb.control('', [Validators.required, Validators.minLength(LIMITS.pastedMin), Validators.maxLength(LIMITS.pastedMax)]),
  });

  readonly detailsSubmitted = signal(false);
  private readonly countsTick = signal(0);
  readonly countsTotal = computed(() => {
    this.countsTick();
    return Object.values(this.configure.controls.counts.getRawValue()).reduce((sum, n) => sum + (Number(n) || 0), 0);
  });

  private uploadKey = 0;

  constructor() {
    this.configure.controls.counts.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.countsTick.update(v => v + 1));

    // While a run is generating, re-read the assessment until it is done.
    toObservable(this.generating).pipe(
      switchMap(on => (on ? timer(POLL_MS, POLL_MS) : EMPTY)),
      exhaustMap(() => {
        const id = this.assessment()?.id;
        return id ? this.api.get(id).pipe(catchError(() => of(null))) : of(null);
      }),
      takeUntilDestroyed(),
    ).subscribe(fresh => {
      if (!fresh) return;
      const before = this.assessment()?.questions.length ?? 0;
      this.assessment.set(fresh);
      if (fresh.status !== 'generating') this.onGenerationEnd(fresh);
      else if (fresh.questions.length !== before) {
        this.announcement.set(this.t.instant('ai_assessments.progress', { n: fresh.questions.length }));
      }
    });
  }

  ngOnInit(): void {
    this.api.courses().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: c => this.courses.set(c), error: () => this.courses.set([]) });
    this.api.usage().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: u => this.usage.set(u), error: () => undefined });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = Number(params.get('id'));
      if (!params.get('id')) {
        this.loadState.set('new');
        this.step.set('details');
        return;
      }
      if (!Number.isInteger(id) || id < 1) { this.loadState.set('error'); return; }
      this.load(id);
    });
  }

  load(id: number): void {
    this.loadState.set('loading');
    this.api.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: a => {
        this.assessment.set(a);
        this.fillForms(a);
        this.loadState.set('ready');
        const wanted = this.route.snapshot.queryParamMap.get('step') as EditorStep | null;
        this.step.set(wanted && STEPS.includes(wanted) ? wanted : (a.questions.length ? 'review' : 'sources'));
      },
      error: () => this.loadState.set('error'),
    });
  }

  /* ── navigation ────────────────────────────────────────────────── */

  stepEnabled(step: EditorStep): boolean {
    return step === 'details' || !!this.assessment();
  }

  async goTo(step: EditorStep): Promise<void> {
    if (step === this.step() || !this.stepEnabled(step)) return;
    const dirty = (this.step() === 'details' && this.details.dirty) || (this.step() === 'configure' && this.configure.dirty);
    if (dirty && this.canEdit()) {
      const discard = await this.confirm.ask({
        title: this.t.instant('ai_assessments.unsaved_title'),
        message: this.t.instant('ai_assessments.unsaved_message'),
        confirmLabel: this.t.instant('ai_assessments.discard'),
      });
      if (!discard) return;
      const a = this.assessment();
      if (a) this.fillForms(a);
    }
    this.setStep(step);
  }

  private setStep(step: EditorStep): void {
    this.step.set(step);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { step }, replaceUrl: true, queryParamsHandling: 'merge' });
  }

  /* ── details & configure ───────────────────────────────────────── */

  showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || this.detailsSubmitted());
  }

  saveDetails(): void {
    this.detailsSubmitted.set(true);
    this.details.markAllAsTouched();
    if (this.details.invalid || this.saving()) return;

    const v = this.details.getRawValue();
    const body = {
      title: v.title.trim(), type: v.type, content_language: v.content_language,
      audience: v.audience.trim() || null, course_id: v.course_id,
    };
    const a = this.assessment();
    this.saving.set(true);

    const request = a ? this.api.update(a.id, body) : this.api.create({
      ...body, difficulty: 'mixed', objectives: null, bloom_levels: [], question_counts: { mcq: 5, true_false: 3 },
    });
    request.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe(saved => {
      this.assessment.set(saved);
      this.fillForms(saved);
      if (!a) {
        this.loadState.set('ready');
        this.toast.success('ai_assessments.toast_created');
        void this.router.navigate(['/admin/ai-assessments', saved.id], { queryParams: { step: 'sources' }, replaceUrl: true });
        this.step.set('sources');
      } else {
        this.toast.success('ai_assessments.toast_saved');
        this.setStep('sources');
      }
    });
  }

  saveConfigure(thenReview = true): void {
    const a = this.assessment();
    if (!a || this.configure.invalid || this.countsTotal() > LIMITS.total || this.saving()) return;
    const v = this.configure.getRawValue();
    const counts: QuestionCounts = {};
    for (const type of QUESTION_TYPES) {
      const n = Math.max(0, Math.min(LIMITS.perType, Math.floor(Number(v.counts[type]) || 0)));
      if (n > 0) counts[type] = n;
    }
    this.saving.set(true);
    this.api.update(a.id, {
      difficulty: v.difficulty,
      objectives: v.objectives.trim() || null,
      bloom_levels: BLOOM_LEVELS.filter(b => v.bloom[b]),
      question_counts: counts,
    }).pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe(saved => {
      this.assessment.set(saved);
      this.fillForms(saved);
      this.toast.success('ai_assessments.toast_saved');
      if (thenReview) this.setStep('review');
    });
  }

  stepCount(type: QuestionType, delta: number): void {
    const c = this.configure.controls.counts.controls[type];
    c.setValue(Math.max(0, Math.min(LIMITS.perType, (Number(c.value) || 0) + delta)));
    c.markAsDirty();
  }

  private configuredTotal(counts: QuestionCounts): number {
    return Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
  }

  private fillForms(a: AiAssessment): void {
    this.details.reset({
      title: a.title, type: a.type, content_language: a.content_language, audience: a.audience ?? '', course_id: a.course?.id ?? null,
    });
    // Keep the chosen course in the list even if the picker did not return it.
    if (a.course && !this.courses().some(c => c.id === a.course!.id)) this.courses.update(list => [a.course!, ...list]);
    this.configure.reset({
      difficulty: a.difficulty,
      objectives: a.objectives ?? '',
      bloom: Object.fromEntries(BLOOM_LEVELS.map(b => [b, a.bloom_levels.includes(b)])) as Record<BloomLevel, boolean>,
      counts: Object.fromEntries(QUESTION_TYPES.map(q => [q, a.question_counts[q] ?? 0])) as Record<QuestionType, number>,
    });
    this.countsTick.update(v => v + 1);
    if (!this.canEdit()) { this.details.disable(); this.configure.disable(); }
  }

  /* ── sources ───────────────────────────────────────────────────── */

  fileSize(bytes: number): string { return fileSize(bytes); }

  onFiles(list: FileList | null, input?: HTMLInputElement): void {
    const a = this.assessment();
    if (!a || !list?.length) return;
    const files = Array.from(list);
    if (input) input.value = '';

    let room = LIMITS.sources - a.sources.length - this.uploads().filter(u => u.state === 'waiting' || u.state === 'uploading').length;
    const queue: { item: UploadItem; file: File }[] = [];
    for (const file of files) {
      const item: UploadItem = { key: ++this.uploadKey, name: file.name, state: 'waiting', error: null };
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!(ACCEPTED as readonly string[]).includes(ext)) {
        item.state = 'error'; item.error = this.t.instant('ai_assessments.upload_err_type');
      } else if (file.size > LIMITS.fileMb * 1024 * 1024) {
        item.state = 'error'; item.error = this.t.instant('ai_assessments.upload_err_size', { mb: LIMITS.fileMb });
      } else if (room <= 0) {
        item.state = 'error'; item.error = this.t.instant('ai_assessments.upload_err_count', { max: LIMITS.sources });
      } else {
        room--;
        queue.push({ item, file });
      }
      this.uploads.update(u => [...u, item]);
    }

    // One at a time: predictable server load, and the count limit holds.
    from(queue).pipe(
      concatMap(({ item, file }) => {
        this.patchUpload(item.key, { state: 'uploading' });
        return this.api.upload(a.id, file).pipe(
          map(source => ({ key: item.key, source })),
          catchError((err: unknown) => {
            this.patchUpload(item.key, { state: 'error', error: this.reason(err) });
            return of(null);
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(done => {
      if (!done) return;
      this.patchUpload(done.key, { state: 'done' });
      this.addSource(done.source);
    });
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.onFiles(event.dataTransfer?.files ?? null);
  }

  clearUploads(): void {
    this.uploads.update(u => u.filter(i => i.state === 'waiting' || i.state === 'uploading'));
  }

  paste(): void {
    const a = this.assessment();
    this.pasteForm.markAllAsTouched();
    if (!a || this.pasteForm.invalid || this.pasting()) return;
    const v = this.pasteForm.getRawValue();
    this.pasting.set(true);
    this.pasteError.set(null);
    this.api.paste(a.id, v.text.trim(), v.label.trim() || null)
      .pipe(finalize(() => this.pasting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: source => {
          this.addSource(source);
          this.pasteForm.reset({ label: '', text: '' });
          this.toast.success('ai_assessments.toast_source_added');
        },
        error: err => this.pasteError.set(this.reason(err)),
      });
  }

  async removeSource(source: AiSource): Promise<void> {
    const a = this.assessment();
    if (!a) return;
    const ok = await this.confirm.ask({
      title: this.t.instant('ai_assessments.remove_source_title'),
      message: this.t.instant('ai_assessments.remove_source_message', { name: source.name }),
    });
    if (!ok) return;
    this.api.removeSource(a.id, source.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.assessment.update(x => (x ? { ...x, sources: x.sources.filter(s => s.id !== source.id) } : x));
      this.toast.success('ai_assessments.toast_source_removed');
    });
  }

  private addSource(source: AiSource): void {
    this.assessment.update(x => (x ? { ...x, sources: [...x.sources, source] } : x));
  }

  private patchUpload(key: number, patch: Partial<UploadItem>): void {
    this.uploads.update(list => list.map(u => (u.key === key ? { ...u, ...patch } : u)));
  }

  /* ── generation ────────────────────────────────────────────────── */

  async generate(): Promise<void> {
    const a = this.assessment();
    if (!a || !this.canGenerate() || this.starting()) return;
    if (a.questions.length) {
      const ok = await this.confirm.ask({
        title: this.t.instant('ai_assessments.regenerate_all_title'),
        message: this.t.instant('ai_assessments.regenerate_all_message', { n: a.questions.length }),
        confirmLabel: this.t.instant('ai_assessments.regenerate_all'),
      });
      if (!ok) return;
    }
    this.starting.set(true);
    this.generationError.set(null);
    this.editingId.set(null);
    this.api.generate(a.id).pipe(finalize(() => this.starting.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.usage.set(res.usage);
        this.assessment.set(res.assessment);
        this.announcement.set(this.t.instant('ai_assessments.generation_started'));
      },
      error: err => {
        this.generationError.set(this.reason(err));
        this.api.usage().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: u => this.usage.set(u), error: () => undefined });
      },
    });
  }

  private onGenerationEnd(a: AiAssessment): void {
    this.api.usage().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: u => this.usage.set(u), error: () => undefined });
    if (a.last_error) {
      this.announcement.set(a.last_error_message ?? '');
    } else {
      this.announcement.set(this.t.instant('ai_assessments.generation_done', { n: a.questions.length }));
      this.toast.success('ai_assessments.generation_done', { params: { n: a.questions.length } });
    }
  }

  regenerateOne(q: AiQuestion): void {
    const a = this.assessment();
    if (!a || this.questionBusy()) return;
    this.questionBusy.set(q.id);
    this.questionError.set(null);
    this.api.regenerate(a.id, q.id).pipe(finalize(() => this.questionBusy.set(null)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.usage.set(res.usage);
        this.replaceQuestion(res.question);
        this.toast.success('ai_assessments.toast_regenerated');
      },
      error: err => this.toast.warn(this.reason(err) ?? 'errors.unexpected'),
    });
  }

  /* ── review & edit ─────────────────────────────────────────────── */

  questionTone(status: QuestionStatus): NasStatusTone { return questionTone(status); }
  statusTone(): NasStatusTone { return statusTone(this.assessment()?.status ?? 'draft'); }

  options(q: AiQuestion): string[] { return usesIndexes(q.type) ? (q.options as string[] | null) ?? [] : []; }
  pairs(q: AiQuestion): MatchingPair[] { return q.type === 'matching' ? (q.options as MatchingPair[] | null) ?? [] : []; }
  isCorrect(q: AiQuestion, i: number): boolean { return !!q.answer && 'indexes' in q.answer && q.answer.indexes.includes(i); }
  tfValue(q: AiQuestion): boolean | null { return q.answer && 'value' in q.answer ? q.answer.value : null; }
  modelAnswer(q: AiQuestion): string { return q.answer && 'text' in q.answer ? q.answer.text : ''; }
  blankAnswers(q: AiQuestion): string[] { return q.answer && 'answers' in q.answer ? q.answer.answers : []; }

  edit(q: AiQuestion): void {
    this.questionError.set(null);
    this.editingId.set(q.id);
  }

  saveQuestion(q: AiQuestion, payload: AiQuestionPayload): void {
    const a = this.assessment();
    if (!a) return;
    this.questionBusy.set(q.id);
    this.questionError.set(null);
    this.api.updateQuestion(a.id, q.id, payload).pipe(finalize(() => this.questionBusy.set(null)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.replaceQuestion(saved);
        this.editingId.set(null);
        this.toast.success('ai_assessments.toast_question_saved');
      },
      error: err => this.questionError.set(this.reason(err)),
    });
  }

  setStatus(q: AiQuestion, status: QuestionStatus): void {
    const a = this.assessment();
    if (!a) return;
    const next: QuestionStatus = q.status === status ? 'pending' : status;
    this.replaceQuestion({ ...q, status: next });
    this.api.setStatus(a.id, q.id, next).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => this.replaceQuestion(saved),
      error: () => this.replaceQuestion(q),
    });
  }

  async removeQuestion(q: AiQuestion, index: number): Promise<void> {
    const a = this.assessment();
    if (!a) return;
    const ok = await this.confirm.ask({
      title: this.t.instant('ai_assessments.delete_question_title'),
      message: this.t.instant('ai_assessments.delete_question_message', { n: index + 1 }),
    });
    if (!ok) return;
    this.api.removeQuestion(a.id, q.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.assessment.update(x => (x ? {
        ...x,
        questions: x.questions.filter(i => i.id !== q.id).map((i, n) => ({ ...i, position: n + 1 })),
        status: x.questions.length > 1 ? x.status : 'draft',
      } : x));
      this.toast.success('ai_assessments.toast_question_deleted');
    });
  }

  onDropQuestion(event: CdkDragDrop<AiQuestion[]>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  /** Keyboard / button alternative to dragging. */
  move(from: number, to: number): void {
    const a = this.assessment();
    if (!a || from === to || to < 0 || to >= a.questions.length) return;
    const before = a.questions;
    const next = [...before];
    moveItemInArray(next, from, to);
    this.assessment.set({ ...a, questions: next.map((q, i) => ({ ...q, position: i + 1 })) });
    this.announcement.set(this.t.instant('ai_assessments.moved', { from: from + 1, to: to + 1 }));
    this.api.reorder(a.id, next.map(q => q.id)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: () => this.assessment.update(x => (x ? { ...x, questions: before } : x)),
    });
  }

  private replaceQuestion(q: AiQuestion): void {
    this.assessment.update(x => (x ? { ...x, questions: x.questions.map(i => (i.id === q.id ? q : i)) } : x));
  }

  /* ── export ────────────────────────────────────────────────────── */

  openExport(): void {
    this.exportError.set(null);
    this.exportOpen.set(true);
  }

  download(): void {
    const a = this.assessment();
    if (!a || this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set(null);
    this.api.export(a.id, this.exportFormat(), this.exportVariant(), a.title)
      .pipe(finalize(() => this.exporting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.exportOpen.set(false); this.toast.success('ai_assessments.toast_exported'); },
        error: err => this.exportError.set(this.reason(err) ?? this.t.instant('common.export_failed')),
      });
  }

  /* ── helpers ───────────────────────────────────────────────────── */

  private reason(err: unknown): string | null {
    if (err instanceof AiActionError) return err.reason;
    return this.t.instant('errors.unexpected');
  }

  trackQuestion = (_: number, q: AiQuestion) => q.id;
}
