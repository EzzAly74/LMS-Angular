import { booleanAttribute, ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type NasStatusTone =
  | 'success' | 'danger' | 'warning' | 'info'
  | 'neutral' | 'teal'   | 'sky';

@Component({
  selector: 'nas-status-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-status-badge.component.html',
  styleUrl:    './nas-status-badge.component.scss',
})
export class NasStatusBadgeComponent {
  @Input() tone: NasStatusTone = 'neutral';
  @Input({ transform: booleanAttribute }) dot = false;
}
