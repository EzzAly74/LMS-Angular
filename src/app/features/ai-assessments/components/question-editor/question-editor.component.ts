import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { startWith, tap } from 'rxjs';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import {
  BLANK, BLOOM_LEVELS, OPTION_LETTERS, usesIndexes,
  type AiQuestion, type AiQuestionPayload, type BloomLevel, type ContentLanguage, type MatchingPair, type QuestionDifficulty,
} from '../../models/ai-assessment.model';

type PairGroup = FormGroup<{ left: FormControl<string>; right: FormControl<string> }>;

interface EditorForm {
  context: FormControl<string>;
  prompt: FormControl<string>;
  explanation: FormControl<string>;
  source_ref: FormControl<string>;
  bloom: FormControl<BloomLevel | ''>;
  difficulty: FormControl<QuestionDifficulty | ''>;
  options: FormArray<FormControl<string>>;
  correct: FormArray<FormControl<boolean>>;
  single: FormControl<number>;
  tf: FormControl<boolean>;
  modelAnswer: FormControl<string>;
  blanks: FormArray<FormControl<string>>;
  pairs: FormArray<PairGroup>;
}

const BOUNDS: Partial<Record<string, readonly [number, number]>> = { mcq: [2, 6], scenario: [2, 6], multi: [3, 8], matching: [3, 8] };
const BLANK_RE = /_{3,}|\[blank\]/gi;

/**
 * Inline editor for one generated question, in its type's shape (the same
 * rules as the server's QuestionType::rules, checked here for early feedback
 * only; the server decides). Emits the stored shape on save.
 */
@Component({
  selector: 'app-ai-question-editor',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './question-editor.component.html',
  styleUrl: './question-editor.component.scss',
})
export class AiQuestionEditorComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly question = input.required<AiQuestion>();
  readonly language = input.required<ContentLanguage>();
  readonly saving = input(false);
  /** The server's reason when the last save was refused. */
  readonly serverError = input<string | null>(null);

  readonly save = output<AiQuestionPayload>();
  readonly cancel = output<void>();

  readonly blooms = BLOOM_LEVELS;
  readonly difficulties: readonly QuestionDifficulty[] = ['easy', 'medium', 'hard'];
  readonly submitted = signal(false);

  readonly form: FormGroup<EditorForm> = this.fb.group({
    context: this.fb.control(''),
    prompt: this.fb.control('', [Validators.required, Validators.maxLength(2000)]),
    explanation: this.fb.control('', Validators.maxLength(4000)),
    source_ref: this.fb.control('', Validators.maxLength(255)),
    bloom: this.fb.control<BloomLevel | ''>(''),
    difficulty: this.fb.control<QuestionDifficulty | ''>(''),
    options: this.fb.array<FormControl<string>>([]),
    correct: this.fb.array<FormControl<boolean>>([]),
    single: this.fb.control(0),
    tf: this.fb.control(true),
    modelAnswer: this.fb.control(''),
    blanks: this.fb.array<FormControl<string>>([]),
    pairs: this.fb.array<PairGroup>([]),
  });

  private readonly promptValue = toSignal(
    this.form.controls.prompt.valueChanges.pipe(startWith(''), tap(p => this.syncBlanks(p))),
    { initialValue: '' },
  );
  private readonly changes = toSignal(this.form.valueChanges, { initialValue: null });

  readonly type = computed(() => this.question().type);
  readonly letters = computed(() => OPTION_LETTERS[this.language()]);
  readonly dir = computed(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));
  readonly bounds = computed(() => BOUNDS[this.type()] ?? null);
  readonly blankCount = computed(() => (this.promptValue().match(BLANK_RE) ?? []).length);

  /** Client-side mirror of the server rules: the first problem to fix, as an i18n key. */
  readonly problem = computed<string | null>(() => {
    this.changes();
    this.promptValue();
    const f = this.form.getRawValue();
    const type = this.type();
    if (!f.prompt.trim()) return 'ai_assessments.q_err_prompt';
    if (type === 'scenario' && !f.context.trim()) return 'ai_assessments.q_err_context';

    if (usesIndexes(type)) {
      const [min, max] = this.bounds() ?? [2, 6];
      const opts = f.options.map(o => o.trim());
      if (opts.length < min || opts.length > max || opts.some(o => !o)) return 'ai_assessments.q_err_options';
      if (new Set(opts.map(o => o.toLowerCase())).size !== opts.length) return 'ai_assessments.q_err_duplicate';
      if (type === 'multi' && !f.correct.some(Boolean)) return 'ai_assessments.q_err_correct';
    }
    if (type === 'short' && !f.modelAnswer.trim()) return 'ai_assessments.q_err_answer';
    if (type === 'fill_blank') {
      if (this.blankCount() === 0) return 'ai_assessments.q_err_no_blank';
      if (f.blanks.slice(0, this.blankCount()).some(b => !b.trim())) return 'ai_assessments.q_err_blanks';
    }
    if (type === 'matching') {
      const [min, max] = this.bounds() ?? [3, 8];
      if (f.pairs.length < min || f.pairs.length > max || f.pairs.some(p => !p.left.trim() || !p.right.trim())) {
        return 'ai_assessments.q_err_pairs';
      }
    }
    return null;
  });

  ngOnInit(): void {
    const q = this.question();
    this.form.patchValue({
      context: q.context ?? '',
      prompt: q.prompt,
      explanation: q.explanation ?? '',
      source_ref: q.source_ref ?? '',
      bloom: q.bloom ?? '',
      difficulty: q.difficulty ?? '',
    });

    if (usesIndexes(q.type)) {
      const indexes = q.answer && 'indexes' in q.answer ? q.answer.indexes : [];
      ((q.options ?? []) as string[]).forEach((text, i) => {
        this.form.controls.options.push(this.fb.control(text));
        this.form.controls.correct.push(this.fb.control(indexes.includes(i)));
      });
      this.form.controls.single.setValue(indexes[0] ?? 0);
    } else if (q.type === 'true_false') {
      this.form.controls.tf.setValue(!!(q.answer && 'value' in q.answer && q.answer.value));
    } else if (q.type === 'short') {
      this.form.controls.modelAnswer.setValue(q.answer && 'text' in q.answer ? q.answer.text : '');
    } else if (q.type === 'fill_blank') {
      const answers = q.answer && 'answers' in q.answer ? q.answer.answers : [];
      // The prompt patch above already created one empty field per blank.
      const blanks = this.form.controls.blanks;
      answers.forEach((a, i) => (i < blanks.length ? blanks.at(i).setValue(a) : blanks.push(this.fb.control(a))));
    } else if (q.type === 'matching') {
      ((q.options ?? []) as MatchingPair[]).forEach(p => this.form.controls.pairs.push(this.pair(p.left, p.right)));
    }
  }

  /** The answer fields for the blanks currently in the prompt (extra ones are kept, not sent). */
  blankFields(): FormControl<string>[] {
    return this.form.controls.blanks.controls.slice(0, this.blankCount());
  }

  /** One answer field per blank, kept in step as the prompt changes (never during rendering). */
  private syncBlanks(prompt: string): void {
    const needed = (prompt.match(BLANK_RE) ?? []).length;
    const blanks = this.form.controls.blanks;
    while (blanks.length < needed) blanks.push(this.fb.control(''), { emitEvent: false });
  }

  addOption(): void {
    const max = this.bounds()?.[1] ?? 6;
    if (this.form.controls.options.length >= max) return;
    this.form.controls.options.push(this.fb.control(''));
    this.form.controls.correct.push(this.fb.control(false));
  }

  removeOption(i: number): void {
    const min = this.bounds()?.[0] ?? 2;
    if (this.form.controls.options.length <= min) return;
    this.form.controls.options.removeAt(i);
    this.form.controls.correct.removeAt(i);
    const single = this.form.controls.single.value;
    if (single === i) this.form.controls.single.setValue(0);
    else if (single > i) this.form.controls.single.setValue(single - 1);
  }

  addPair(): void {
    if (this.form.controls.pairs.length < (this.bounds()?.[1] ?? 8)) this.form.controls.pairs.push(this.pair('', ''));
  }

  removePair(i: number): void {
    if (this.form.controls.pairs.length > (this.bounds()?.[0] ?? 3)) this.form.controls.pairs.removeAt(i);
  }

  insertBlank(textarea: HTMLTextAreaElement): void {
    const c = this.form.controls.prompt;
    const start = textarea.selectionStart ?? c.value.length;
    const end = textarea.selectionEnd ?? start;
    c.setValue(`${c.value.slice(0, start)}${BLANK}${c.value.slice(end)}`);
    queueMicrotask(() => { textarea.focus(); textarea.setSelectionRange(start + BLANK.length, start + BLANK.length); });
  }

  submit(): void {
    this.submitted.set(true);
    if (this.problem() || this.form.invalid) return;

    const f = this.form.getRawValue();
    const type = this.type();
    const payload: AiQuestionPayload = {
      prompt: f.prompt.trim(),
      explanation: f.explanation.trim() || null,
      source_ref: f.source_ref.trim() || null,
      bloom: f.bloom || null,
      difficulty: f.difficulty || null,
    };

    if (type === 'scenario') payload.context = f.context.trim();
    if (usesIndexes(type)) {
      payload.options = f.options.map(o => o.trim());
      payload.answer = {
        indexes: type === 'multi'
          ? f.correct.map((on, i) => (on ? i : -1)).filter(i => i >= 0)
          : [Math.min(f.single, f.options.length - 1)],
      };
    } else if (type === 'true_false') {
      payload.answer = { value: f.tf };
    } else if (type === 'short') {
      payload.answer = { text: f.modelAnswer.trim() };
    } else if (type === 'fill_blank') {
      payload.answer = { answers: f.blanks.slice(0, this.blankCount()).map(b => b.trim()) };
    } else if (type === 'matching') {
      payload.options = f.pairs.map(p => ({ left: p.left.trim(), right: p.right.trim() }));
    }

    this.save.emit(payload);
  }

  private pair(left: string, right: string): PairGroup {
    return this.fb.group({ left: this.fb.control(left), right: this.fb.control(right) });
  }
}
