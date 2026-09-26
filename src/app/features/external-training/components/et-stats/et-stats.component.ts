import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { NasStatTileComponent } from '../../../../shared/nas/nas-stat-tile/nas-stat-tile.component';
import { RequestStats } from '../../models/external-training.model';

/**
 * The three tiles on both External Training pages (Figma 2181:116177,
 * 2181:116391): pending now, requests this year, rejected this year.
 */
@Component({
  selector: 'app-et-stats',
  standalone: true,
  imports: [TranslateModule, SkeletonModule, NasStatTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ets" [attr.aria-label]="'external_training.stats_label' | translate">
      @if (stats(); as s) {
        <nas-stat-tile tone="amber" icon="assets/icons/figma/clock-countdown-20.svg"
          [value]="'' + s.pending" [label]="'external_training.stats.pending' | translate" />
        <nas-stat-tile tone="teal" icon="assets/icons/figma/check-circle-20.svg"
          [value]="'' + s.this_year" [label]="'external_training.stats.this_year' | translate: { year: s.year }" />
        <nas-stat-tile tone="red" icon="assets/icons/figma/x-20.svg"
          [value]="'' + s.rejected_this_year" [label]="'external_training.stats.rejected' | translate" />
      } @else {
        @for (i of [1, 2, 3]; track i) { <p-skeleton height="111px" borderRadius="16px" /> }
      }
    </section>
  `,
  styles: `
    .ets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--nas-space-2); }
    @media (max-width: 767px) { .ets { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class EtStatsComponent {
  readonly stats = input<RequestStats | null>(null);
}
