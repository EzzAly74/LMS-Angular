import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LocaleService } from '../../../../core/services/locale.service';
import { pluralKey } from '../../../../core/utils/plural-key';
import { DistributionBucket, QuestionType, TemplateQuestion } from '../../models/evaluation.model';

interface Bar {
  value: number;
  count: number;
  pct: number;
  on: boolean;
}

/**
 * One question of a template with its answer breakdown - Figma 2169:108198
 * (results) and 2169:108801 / 2169:109264 (one learner's result).
 *
 * Star questions list 5 stars down to 1; scale questions 1 up to the maximum,
 * as drawn. The outlined row is `highlight`: the most given answer on the
 * results page, the learner's own answer on their page. Bars are sized to the
 * largest bucket, and every row states its count in text, so nothing is
 * told by bar length or outline alone.
 */
@Component({
  selector: 'ev-question-card',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ev-question-card.component.html',
  styleUrl: './ev-question-card.component.scss',
})
export class EvQuestionCardComponent {
  private readonly locale = inject(LocaleService).locale;

  readonly index     = input.required<number>();
  readonly question  = input.required<TemplateQuestion>();
  /** The value to outline; null outlines nothing. */
  readonly highlight = input<number | null>(null);
  /** Per-row learner counts (results page) or not (a learner's page). */
  readonly showCounts = input(true);
  /** The template-wide totals; off for a question no longer in the template. */
  readonly showTotal = input(true);
  /** A learner's written answer, for a text question on their page. */
  readonly answerText = input<string | null>(null);

  readonly type = computed<QuestionType>(() => this.question().type);

  readonly bars = computed<Bar[]>(() => {
    const dist: DistributionBucket[] = this.question().distribution ?? [];
    const max = Math.max(0, ...dist.map(d => d.count));
    const ordered = this.type() === 'five' ? dist : [...dist].reverse();
    return ordered.map(d => ({
      value: d.value,
      count: d.count,
      pct: max > 0 ? Math.round((d.count / max) * 100) : 0,
      on: d.value === this.highlight(),
    }));
  });

  /** The five star slots of a star row: filled up to its value. */
  readonly starSlots = [1, 2, 3, 4, 5];

  readonly typeKey = computed(() => `evaluations.qtype.${this.type()}`);

  totalKey(): string {
    return pluralKey('evaluations.total_evaluations', this.question().responses, this.locale());
  }

  starsKey(n: number): string {
    return pluralKey('evaluations.stars', n, this.locale());
  }

  countKey(n: number): string {
    return pluralKey('evaluations.learner_count', n, this.locale());
  }

  average(): string | null {
    const a = this.question().average;
    return a === null ? null : a.toFixed(1);
  }
}
