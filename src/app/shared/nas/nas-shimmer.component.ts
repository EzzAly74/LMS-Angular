import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'nas-shimmer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="nas-shimmer"
          [style.width]="width"
          [style.height]="height"
          [style.border-radius]="borderRadius"></span>
  `,
  styles: [`
    :host { display: block; line-height: 0; }
    .nas-shimmer {
      display: block;
      max-width: 100%;
      background-color: #e6e7e8;
      background-image: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.65) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      background-size: 200% 100%;
      background-repeat: no-repeat;
      background-position: -150% 0;
      animation: nas-shimmer-pulse 1.4s ease-in-out infinite;
      will-change: background-position;
    }
    @keyframes nas-shimmer-pulse {
      0%   { background-position: -150% 0; }
      100% { background-position:  150% 0; }
    }
  `],
})
export class NasShimmerComponent {
  @Input() width        = '100%';
  @Input() height       = '12px';
  @Input() borderRadius = '4px';
}
