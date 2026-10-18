import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { EMPTY, catchError, exhaustMap, filter, finalize, interval, map, of, switchMap, takeWhile, timer } from 'rxjs';
import { LocaleService } from '../../core/services/locale.service';
import { ToastService } from '../../core/services/toast.service';
import { NasIconComponent } from '../nas/nas-icon/nas-icon.component';
import { AiQuestionsApiService, AiRefusal } from './ai-questions-api.service';
import {
  AI_BLOOM_LEVELS, AI_DIFFICULTIES, AI_FILE_EXTENSIONS, AI_LIMITS, AI_QUESTION_TYPES,
  type AiBloomLevel, type AiDifficulty, type AiDraftQuestion, type AiGenerateSettings, type AiQuestionType, type AiTarget, type AiUsage,
} from './ai-questions.model';

type Phase = 'form' | 'running' | 'review' | 'failed';
type SourceTab = 'upload' | 'paste';
type PresetKey = 'quick' | 'standard' | 'full';

/** How often a running generation is re-read. */
const POLL_MS = 2500;

/** One-click question mixes (each stays editable). */
const PRESETS: Record<PresetKey, Record<AiQuestionType, number>> = {
  quick:    { mcq: 5, yes_no: 0, open: 0, reorder: 0 },
  standard: { mcq: 6, yes_no: 2, open: 1, reorder: 1 },
  full:     { mcq: 10, yes_no: 4, open: 3, reorder: 3 },
};

const TYPE_ICONS: Record<AiQuestionType, string> = {
  mcq: 'list-bullets',
  yes_no: 'check-circle',
  open: 'file-text',
  reorder: 'list-numbers',
};

/**
 * "Generate with AI" (backend D-113), opened from the Quizzes / Assignments
 * pages and from the Add / Edit forms.
 *
 *   form    -> course material (upload / paste), the question mix, options
 *   running -> the server writes the questions in English and Arabic; the
 *              dialog polls, with a real elapsed timer
 *   review  -> every question with its answer; untick what is not wanted,
 *              regenerate with the same settings, or add the selection
 *
 * Nothing is saved here: `generated` hands the chosen questions to the form,
 * which saves them through its own rules.
 */
@Component({
  selector: 'app-ai-generate-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, DialogModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-generate-dialog.component.html',
  styleUrl: './ai-generate-dialog.component.scss',
})
export class AiGenerateDialogComponent {
  private readonly api = inject(AiQuestionsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly t = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale = inject(LocaleService).locale;

  readonly target = input.required<AiTarget>();
  /** The form's course and type, when known: recorded with the run and used in the prompt. */
  readonly courseId = input<number | null>(null);
  readonly assessmentType = input<'pre' | 'mid' | 'post' | null>(null);
  readonly visible = model(false);
  readonly generated = output<AiDraftQuestion[]>();

  readonly types = AI_QUESTION_TYPES;
  readonly typeIcons = TYPE_ICONS;
  readonly blooms = AI_BLOOM_LEVELS;
  readonly difficulties = AI_DIFFICULTIES;
  readonly presets: readonly PresetKey[] = ['quick', 'standard', 'full'];
  readonly limits = AI_LIMITS;
  readonly accept = AI_FILE_EXTENSIONS.map(e => `.${e}`).join(',');

  readonly phase = signal<Phase>('form');
  readonly tab = signal<SourceTab>('upload');
  readonly usage = signal<AiUsage | null>(null);
  readonly files = signal<File[]>([]);
  readonly fileError = signal<string | null>(null);
  readonly serverError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly starting = signal(false);
  readonly dragOver = signal(false);
  readonly elapsed = signal(0);
  readonly results = signal<AiDraftQuestion[]>([]);
  readonly selected = signal<ReadonlySet<number>>(new Set());
  private readonly generationId = signal<number | null>(null);
  private lastSettings: AiGenerateSettings | null = null;

  readonly form = this.fb.group({
    text: this.fb.control('', Validators.maxLength(AI_LIMITS.pastedMax)),
    counts: this.fb.group(Object.fromEntries(AI_QUESTION_TYPES.map(type => [
      type, this.fb.control(PRESETS.standard[type], [Validators.min(0), Validators.max(AI_LIMITS.perType)]),
    ])) as Record<AiQuestionType, FormControl<number>>),
    difficulty: this.fb.control<AiDifficulty>('mixed'),
    score: this.fb.control(1, [Validators.required, Validators.min(0), Validators.max(100)]),
    bloom: this.fb.group(Object.fromEntries(AI_BLOOM_LEVELS.map(b => [b, this.fb.control(false)])) as Record<AiBloomLevel, FormControl<boolean>>),
    objectives: this.fb.control('', Validators.maxLength(2000)),
  });

  private readonly tick = signal(0);
  readonly counts = computed(() => {
    this.tick();
    return this.form.controls.counts.getRawValue();
  });
  readonly total = computed(() => Object.values(this.counts()).reduce((s, n) => s + (Number(n) || 0), 0));
  readonly textLength = computed(() => {
    this.tick();
    return this.form.controls.text.value.trim().length;
  });
  readonly bloomCount = computed(() => {
    this.tick();
    return Object.values(this.form.controls.bloom.getRawValue()).filter(Boolean).length;
  });
  readonly activePreset = computed<PresetKey | null>(() => {
    const c = this.counts();
    return this.presets.find(p => AI_QUESTION_TYPES.every(type => (Number(c[type]) || 0) === PRESETS[p][type])) ?? null;
  });
  readonly elapsedLabel = computed(() => {
    const s = this.elapsed();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  readonly usagePercent = computed(() => {
    const u = this.usage();
    return u && u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
  });
  readonly selectedCount = computed(() => this.selected().size);
  readonly resultCounts = computed(() => {
    const out: Partial<Record<AiQuestionType, number>> = {};
    for (const q of this.results()) out[q.type] = (out[q.type] ?? 0) + 1;
    return AI_QUESTION_TYPES.filter(type => out[type]).map(type => ({ type, n: out[type] ?? 0 }));
  });

  /** The first thing to fix before Generate, as an i18n key; null when ready. */
  readonly problem = computed<string | null>(() => {
    this.tick();
    const u = this.usage();
    if (u && !u.configured) return 'ai_questions.err_not_configured';
    if (u && u.used >= u.limit) return 'ai_questions.err_daily_limit';
    if (!this.files().length && this.textLength() < AI_LIMITS.pastedMin) return 'ai_questions.err_no_source';
    if (this.total() < 1 || this.total() > AI_LIMITS.total) return 'ai_questions.err_counts';
    if (this.form.invalid) return 'ai_questions.err_invalid';
    return null;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.tick.update(v => v + 1));

    // Each time the dialog opens: fresh usage; a failed run goes back to the form.
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        if (this.phase() === 'failed') this.phase.set('form');
        this.refreshUsage();
      });
    });

    // Poll the running generation until it ends.
    toObservable(this.generationId).pipe(
      switchMap(id => (id === null ? EMPTY : timer(POLL_MS, POLL_MS).pipe(
        exhaustMap(() => this.api.get(this.target(), id).pipe(catchError(() => of(null)))),
        filter(g => g !== null && g.status !== 'running'),
        takeWhile(() => this.generationId() === id),
      ))),
      takeUntilDestroyed(),
    ).subscribe(g => {
      if (!g) return;
      this.generationId.set(null);
      if (g.status === 'succeeded' && g.questions.length) {
        this.results.set(g.questions);
        this.selected.set(new Set(g.questions.map((_, i) => i)));
        this.phase.set('review');
        // Hidden while it ran: bring the review back.
        if (!this.visible()) this.visible.set(true);
      } else {
        this.serverError.set(g.error_message ?? this.t.instant('ai_questions.err_failed'));
        this.phase.set('failed');
      }
      this.refreshUsage();
    });

    // A real elapsed timer while a run is going.
    toObservable(this.phase).pipe(
      switchMap(p => (p === 'running' ? interval(1000).pipe(map(i => i + 1)) : of(0))),
      takeUntilDestroyed(),
    ).subscribe(s => this.elapsed.set(s));
  }

  /* ── sources ───────────────────────────────────────────────────── */

  addFiles(list: FileList | null, input?: HTMLInputElement): void {
    if (!list?.length) return;
    this.fileError.set(null);
    const next = [...this.files()];
    for (const file of Array.from(list)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!(AI_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
        this.fileError.set(this.t.instant('ai_questions.file_type', { name: file.name }));
      } else if (file.size > AI_LIMITS.fileMb * 1024 * 1024) {
        this.fileError.set(this.t.instant('ai_questions.file_size', { name: file.name, mb: AI_LIMITS.fileMb }));
      } else if (next.length >= AI_LIMITS.files) {
        this.fileError.set(this.t.instant('ai_questions.file_count', { max: AI_LIMITS.files }));
      } else if (!next.some(f => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }
    this.files.set(next);
    if (input) input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.addFiles(event.dataTransfer?.files ?? null);
  }

  removeFile(index: number): void {
    this.files.update(list => list.filter((_, i) => i !== index));
  }

  fileSize(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  fileIcon(name: string): string {
    return name.toLowerCase().endsWith('.pdf') ? 'file-pdf' : 'file-text';
  }

  /* ── mix ───────────────────────────────────────────────────────── */

  applyPreset(key: PresetKey): void {
    this.form.controls.counts.setValue({ ...PRESETS[key] });
  }

  step(type: AiQuestionType, delta: number): void {
    const c = this.form.controls.counts.controls[type];
    c.setValue(Math.max(0, Math.min(AI_LIMITS.perType, (Number(c.value) || 0) + delta)));
  }

  stepScore(delta: number): void {
    const c = this.form.controls.score;
    c.setValue(Math.max(0, Math.min(100, (Number(c.value) || 0) + delta)));
  }

  /* ── run ───────────────────────────────────────────────────────── */

  generate(): void {
    this.submitted.set(true);
    if (this.problem() || this.starting()) return;
    const v = this.form.getRawValue();
    const counts: Partial<Record<AiQuestionType, number>> = {};
    for (const type of AI_QUESTION_TYPES) {
      const n = Math.max(0, Math.min(AI_LIMITS.perType, Math.floor(Number(v.counts[type]) || 0)));
      if (n > 0) counts[type] = n;
    }
    this.lastSettings = {
      counts,
      difficulty: v.difficulty,
      bloom_levels: AI_BLOOM_LEVELS.filter(b => v.bloom[b]),
      objectives: v.objectives.trim() || null,
      score: Math.max(0, Math.min(100, Math.floor(Number(v.score) || 0))),
      course_id: this.courseId(),
      assessment_type: this.assessmentType(),
    };
    this.run(this.lastSettings);
  }

  /** Same material and settings, a fresh set (one more run against the daily limit). */
  regenerate(): void {
    if (this.lastSettings) this.run(this.lastSettings);
  }

  private run(settings: AiGenerateSettings): void {
    this.starting.set(true);
    this.serverError.set(null);
    this.api.start(this.target(), settings, this.files(), this.form.controls.text.value).pipe(
      finalize(() => this.starting.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: res => {
        this.usage.set(res.usage);
        this.phase.set('running');
        this.generationId.set(res.generation.id);
      },
      error: (err: unknown) => {
        this.serverError.set(err instanceof AiRefusal ? err.reason : this.t.instant('errors.unexpected'));
        if (this.phase() === 'review') this.phase.set('failed');
      },
    });
  }

  /* ── review ────────────────────────────────────────────────────── */

  toggle(index: number): void {
    this.selected.update(set => {
      const next = new Set(set);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  toggleAll(): void {
    this.selected.set(this.selectedCount() === this.results().length ? new Set() : new Set(this.results().map((_, i) => i)));
  }

  /** The question in the reader's language first. */
  text(q: AiDraftQuestion): string { return this.locale() === 'ar' ? q.question_ar : q.question_en; }
  otherText(q: AiDraftQuestion): string { return this.locale() === 'ar' ? q.question_en : q.question_ar; }
  options(q: AiDraftQuestion): string[] { return this.locale() === 'ar' ? q.options_ar : q.options_en; }
  answer(q: AiDraftQuestion): string | null { return this.locale() === 'ar' ? q.correct_answer_ar : q.correct_answer_en; }
  explanation(q: AiDraftQuestion): string | null { return this.locale() === 'ar' ? q.explanation_ar : q.explanation_en; }
  isCorrect(q: AiDraftQuestion, option: string): boolean { return q.type === 'mcq' && option === this.answer(q); }

  addSelected(): void {
    const chosen = this.results().filter((_, i) => this.selected().has(i));
    if (!chosen.length) return;
    this.generated.emit(chosen);
    this.toast.success('ai_questions.toast_added', { params: { n: chosen.length } });
    this.reset();
    this.visible.set(false);
  }

  backToForm(): void {
    this.serverError.set(null);
    this.phase.set('form');
  }

  close(): void {
    this.visible.set(false);
  }

  private refreshUsage(): void {
    this.api.usage(this.target()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: u => this.usage.set(u),
      error: () => this.usage.set(null),
    });
  }

  private reset(): void {
    this.phase.set('form');
    this.results.set([]);
    this.selected.set(new Set());
    this.files.set([]);
    this.submitted.set(false);
    this.serverError.set(null);
    this.form.controls.text.setValue('');
  }
}
