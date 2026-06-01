import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type NasTrendDirection = 'up' | 'down' | 'flat';
export type NasStatTone = 'teal' | 'amber' | 'green' | 'sky' | 'purple' | 'navy' | 'neutral';

@Component({
  selector: 'nas-stat-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-stat-card.component.html',
  styleUrl:    './nas-stat-card.component.scss',
})
export class NasStatCardComponent {
  @Input() icon = 'pi pi-chart-line';
  @Input() iconTone: NasStatTone = 'teal';
  @Input() label = '';
  @Input() value: string | number | null = '';
  @Input() subline?: string | null;
  @Input() trend?: string | null;
  @Input() trendDirection: NasTrendDirection = 'up';
  @Input() clickable = false;

  protected hasSubline = false;

  get trendIcon(): string {
    return this.trendDirection === 'up'   ? 'pi pi-arrow-up'
         : this.trendDirection === 'down' ? 'pi pi-arrow-down'
         : 'pi pi-minus';
  }
}
