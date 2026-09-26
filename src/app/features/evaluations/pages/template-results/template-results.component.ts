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
import { ApiService } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { EvQuestionCardComponent } from '../../components/ev-question-card/ev-question-card.component';
import { NasStatTileComponent } from '../../../../shared/nas/nas-stat-tile/nas-stat-tile.component';
import { TemplateQuestion, TemplateResults, formatScore } from '../../models/evaluation.model';

type LoadState = 'loading' | 'ready' | 'error' | 'not-found';

/**
 * One template's results - Figma 2169:108198 (D4).
 *
 * GET admin/evaluations/{id}/results: the header tiles (score, learners
 * scored of eligible, questions) and each question's breakdown. The outlined
 * row in each breakdown is the most given answer.
 */
@Component({
  selector: 'app-evaluation-template-results',
  standalone: true,
  imports: [RouterLink, TranslateModule, SkeletonModule, NasDatePipe, EvQuestionCardComponent, NasStatTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-results.component.html',
  styleUrl: './template-results.component.scss',
})
export class EvaluationTemplateResultsComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale   = inject(LocaleService).locale;

  /** Route param, bound by withComponentInputBinding. */
  readonly id = input.required<string>();

  readonly data  = signal<TemplateResults | null>(null);
  readonly state = signal<LoadState>('loading');

  readonly scoreValue = computed(() => {
    const s = this.data()?.summary;
    return s && s.score !== null ? formatScore(s.score) : null;
  });

  readonly scoreSuffix = computed(() => `/${formatScore(this.data()?.summary.score_max ?? 5)}`);

  private readonly fetch$ = new Subject<string>();

  constructor() {
    withLocaleReload(() => this.fetch$.next(this.id()));
    // Navigating between templates reuses the component.
    effect(() => {
      const id = this.id();
      untracked(() => this.fetch$.next(id));
    });
  }

  ngOnInit(): void {
    this.fetch$
      .pipe(
        switchMap(id => {
          this.state.set('loading');
          return this.api.get<TemplateResults>(`${API.ADMIN_EVALUATIONS}/${encodeURIComponent(id)}/results`).pipe(
            map(res => ({ ok: true as const, res })),
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
        this.data.set(r.res.result);
        this.state.set('ready');
      });
  }

  retry(): void {
    this.fetch$.next(this.id());
  }

  /** The most given answer, outlined as in the frame; none when nobody answered. */
  mode(q: TemplateQuestion): number | null {
    const dist = q.distribution ?? [];
    let best: { value: number; count: number } | null = null;
    for (const d of dist) {
      if (d.count > 0 && (best === null || d.count > best.count)) best = d;
    }
    return best?.value ?? null;
  }
}
