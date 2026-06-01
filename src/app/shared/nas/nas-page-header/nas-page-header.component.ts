import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'nas-page-header',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-page-header.component.html',
  styleUrl:    './nas-page-header.component.scss',
})
export class NasPageHeaderComponent {
  @Input() title = '';
  @Input() subtitle?: string | null;
  @Input() eyebrow?: string | null;
}
