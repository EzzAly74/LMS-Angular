import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { ApiParams, ApiService } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { EvQuestionCardComponent } from '../../components/ev-question-card/ev-question-card.component';
import { EvStatTileComponent } from '../../components/ev-stat-tile/ev-stat-tile.component';
import {
  EvaluationSubmission,
  SubmissionAnswer,
  TemplateQuestion,
  TemplateResults,
  formatScore,
} from '../../models/evaluation.model';

type LoadState = 'loading' | 'ready' | 'error' | 'not-found';

interface AnswerView {
  answer: SubmissionAnswer;
  /** The template-wide breakdown the answer is shown against, when the question still exists. */
  question: TemplateQuestion | null;
  highlight: number | null;
}

/**
 * One learner's evaluation result - Figma 2169:108801 (passing) and
 * 2169:109264 (failing, the score in red) (D4).
 *
 * GET admin/evaluations/scores/{learner}/{course}?template_id=, then the
 * template's results for the breakdown each answer is drawn against: the
 * frame outlines the learner's own answer on the template-wide bars and hides
 * the per-row counts.
 */
@Component({
  selector: 'app-evaluation-submission',
  standalone: true,
  imports: [RouterLink, TranslateModule, SkeletonModule, NasDatePipe, EvQuestionCardComponent, EvStatTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './submission.component.html',
  styleUrl: '../template-results/template-results.component.scss',
})
export class EvaluationSubmissionComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale   = inject(LocaleService).locale;

  /** Route params and ?template=, bound by withComponentInputBinding. */
  readonly learner  = input.required<string>();
  readonly course   = input.required<string>();
  readonly template = input<string | undefined>(undefined);

  readonly data    = signal<EvaluationSubmission | null>(null);
  readonly results = signal<TemplateResults | null>(null);
  readonly state   = signal<LoadState>('loading');

  readonly scoreValue  = computed(() => {
    const s = this.data()?.score;
    return s === null || s === undefined ? null : formatScore(s);
  });
  readonly scoreSuffix = computed(() => `/${formatScore(this.data()?.score_max ?? 5)}`);

  readonly answers = computed<AnswerView[]>(() => {
    const d = this.data();
    if (!d) return [];
    const byId = new Map((this.results()?.questions ?? []).map(q => [q.id, q]));
    return d.answers.map(a => {
      const n = Number(a.answer);
      return {
        answer: a,
        question: byId.get(a.evaluation_id) ?? null,
        highlight: a.is_text || !Number.isFinite(n) ? null : n,
      };
    });
  });

  private readonly fetch$ = new Subject<void>();

  constructor() {
    withLocaleReload(() => this.fetch$.next());
    effect(() => {
      this.learner();
      this.course();
      this.template();
      untracked(() => this.fetch$.next());
    });
  }

  ngOnInit(): void {
    this.fetch$
      .pipe(
        switchMap(() => {
          this.state.set('loading');
          const url = `${API.ADMIN_EVALUATION_SCORES}/${encodeURIComponent(this.learner())}/${encodeURIComponent(this.course())}`;
          const params: ApiParams = {};
          const t = Number(this.template());
          if (Number.isInteger(t) && t > 0) params['template_id'] = t;

          return this.api.get<EvaluationSubmission>(url, params).pipe(
            switchMap(sub => {
              const templateId = sub.result.template.id;
              // A breakdown is context, not the result: without it the
              // answers still render, just without the template-wide bars.
              const results$ = templateId === null
                ? of(null)
                : this.api.get<TemplateResults>(`${API.ADMIN_EVALUATIONS}/${templateId}/results`).pipe(
                    map(r => r.result),
                    catchError(() => of(null)),
                  );
              return results$.pipe(map(results => ({ ok: true as const, sub: sub.result, results })));
            }),
            catchError((e: unknown) => of({ ok: false as const, notFound: e instanceof HttpErrorResponse && e.status === 404 })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(r => {
        if (!r.ok) {
          this.state.set(r.notFound ? 'not-found' : 'error');
          return;
        }
        this.data.set(r.sub);
        this.results.set(r.results);
        this.state.set('ready');
      });
  }

  retry(): void {
    this.fetch$.next();
  }

  /** A question card for an answer whose question is gone from the template. */
  fallbackQuestion(a: SubmissionAnswer): TemplateQuestion {
    return {
      id: a.evaluation_id,
      title: a.title,
      type: a.type,
      required: false,
      scale_max: a.scale_max,
      responses: 0,
      average: null,
      distribution: null,
    };
  }

  /** The answer as text: prose as written, a scale answer as "4 / 5". */
  answerText(a: SubmissionAnswer): string | null {
    if (a.answer === null || a.answer === '') return null;
    return a.is_text ? a.answer : `${a.answer} / ${a.scale_max ?? ''}`;
  }
}
