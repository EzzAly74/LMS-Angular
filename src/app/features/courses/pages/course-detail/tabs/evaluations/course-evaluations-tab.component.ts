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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, switchMap, catchError, of, map, forkJoin } from 'rxjs';
import { NasStatTileComponent } from '../../../../../../shared/nas/nas-stat-tile/nas-stat-tile.component';
import { EvQuestionCardComponent } from '../../../../../evaluations/components/ev-question-card/ev-question-card.component';
import {
  QuestionType,
  TemplateQuestion,
  TemplateResults,
  formatScore,
} from '../../../../../evaluations/models/evaluation.model';
import { CoursesApiService } from '../../../../services/courses-api.service';
import { LocaleService } from '../../../../../../core/services/locale.service';
import { pluralKey } from '../../../../../../core/utils/plural-key';
import { withLocaleReload } from '../../../../../../core/utils/with-locale-reload';
import type { CourseEvaluationSummary, CourseEvaluationTemplate } from '../../../../models/course-detail.model';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Course Details - Evaluations tab (Figma 2266:130142; replaces Ratings,
 * Q-050): "N reviews · M with comments", the template's tiles and card, and
 * each question's breakdown - every figure counting this course's answers
 * only. Reuses the D4 results pieces (ev-question-card, nas-stat-tile).
 *
 * Normally one template applies to a course (Q-032); when several have
 * answers here, a picker chooses which one is shown. Figma's "Published"
 * badge is not built: templates have no draft / published state.
 */
@Component({
  selector: 'app-course-evaluations-tab',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslateModule, DropdownModule, SkeletonModule, NasStatTileComponent, EvQuestionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-evaluations-tab.component.html',
  styleUrl: './course-evaluations-tab.component.scss',
})
export class CourseEvaluationsTabComponent implements OnInit {
  private readonly api = inject(CoursesApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = inject(LocaleService).locale;

  readonly courseId = input.required<number>();

  readonly state = signal<LoadState>('loading');
  readonly summary = signal<CourseEvaluationSummary | null>(null);
  readonly results = signal<TemplateResults | null>(null);
  readonly templateId = signal<number | null>(null);

  readonly template = computed<CourseEvaluationTemplate | null>(
    () => this.summary()?.templates.find(t => t.id === this.templateId()) ?? null,
  );

  readonly scoreValue = computed(() => {
    const s = this.results()?.summary.score;
    return s === null || s === undefined ? null : formatScore(s);
  });

  readonly scoreSuffix = computed(() => `/${formatScore(this.results()?.summary.score_max ?? 5)}`);

  /** One type's label when every question shares it, "Mixed" otherwise. */
  readonly questionTypeKey = computed(() => {
    const types = new Set<QuestionType>((this.results()?.questions ?? []).map(q => q.type));
    if (types.size === 0) return null;
    return types.size === 1 ? `evaluations.qtype.${[...types][0]}` : 'course_detail.mixed_types';
  });

  private readonly fetch$ = new Subject<number | null>();

  constructor() {
    withLocaleReload(() => this.load());
  }

  ngOnInit(): void {
    // Loads the summary, then the chosen template's results for this course.
    this.fetch$
      .pipe(
        switchMap(wanted =>
          this.api.evaluationSummary(this.courseId()).pipe(
            switchMap(s => {
              const summary = s.result;
              const id = summary.templates.some(t => t.id === wanted) ? wanted : (summary.templates[0]?.id ?? null);
              const results$ = id === null ? of(null) : this.api.templateResults(id, this.courseId()).pipe(map(r => r.result));
              return forkJoin({ summary: of(summary), id: of(id), results: results$ });
            }),
            map(out => ({ ok: true as const, ...out })),
            catchError(() => of({ ok: false as const })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(out => {
        if (!out.ok) {
          this.state.set('error');
          return;
        }
        this.summary.set(out.summary);
        this.templateId.set(out.id);
        this.results.set(out.results);
        this.state.set('ready');
      });
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.fetch$.next(this.templateId());
  }

  pickTemplate(id: number): void {
    this.templateId.set(id);
    this.load();
  }

  reviewsKey(n: number): string {
    return pluralKey('course_detail.reviews_count', n, this.locale());
  }

  commentsKey(n: number): string {
    return pluralKey('course_detail.with_comments', n, this.locale());
  }

  /** The most given answer, outlined as in the frame; none when nobody answered. */
  mode(q: TemplateQuestion): number | null {
    let best: { value: number; count: number } | null = null;
    for (const d of q.distribution ?? []) {
      if (d.count > 0 && (best === null || d.count > best.count)) best = d;
    }
    return best?.value ?? null;
  }
}
