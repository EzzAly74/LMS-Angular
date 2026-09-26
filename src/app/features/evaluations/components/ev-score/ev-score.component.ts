import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { formatScore } from '../../models/evaluation.model';

/**
 * A score cell of the Evaluation lists (Figma 2009:88432, 2017:52260): the
 * green or red filled circle, then "4.0/5.0"; "Unscored" when there is none.
 *
 * The verdict comes from the API (`passed`), never from a threshold held
 * here, and the mark carries a text alternative so pass / fail is not told
 * by colour alone.
 */
@Component({
  selector: 'ev-score',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (score() !== null) {
      <span class="ev-score">
        @if (passed() !== null) {
          <img [src]="passed() ? 'assets/icons/figma/check-circle-fill-14.svg' : 'assets/icons/figma/x-circle-fill-14.svg'"
            width="14" height="14"
            [attr.alt]="(passed() ? 'evaluations.result.passed' : 'evaluations.result.failed') | translate" />
        }
        <span dir="ltr">{{ label() }}</span>
      </span>
    } @else {
      <span class="ev-score ev-score--none">{{ 'evaluations.result.unscored' | translate }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .ev-score { display: inline-flex; align-items: center; gap: var(--nas-space-1); white-space: nowrap; }
    .ev-score img { flex-shrink: 0; display: block; }
    .ev-score--none { color: var(--nas-color-text-muted); }
  `,
})
export class EvScoreComponent {
  readonly score    = input.required<number | null>();
  readonly passed   = input<boolean | null>(null);
  readonly scoreMax = input(5);

  readonly label = computed(() => {
    const s = this.score();
    return s === null ? '' : `${formatScore(s)}/${formatScore(this.scoreMax())}`;
  });
}
