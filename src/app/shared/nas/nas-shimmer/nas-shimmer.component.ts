import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'nas-shimmer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-shimmer.component.html',
  styleUrl: './nas-shimmer.component.scss',
})
export class NasShimmerComponent {
  @Input() width        = '100%';
  @Input() height       = '12px';
  @Input() borderRadius = '4px';
}
