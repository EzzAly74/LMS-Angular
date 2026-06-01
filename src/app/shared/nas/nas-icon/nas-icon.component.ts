import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Lightweight icon — loads a Phosphor-style SVG from
 * `src/assets/icons/phosphor/<name>.svg` and renders it as a CSS-mask
 * so it inherits the current text `color` like a real glyph.
 *
 * Used in lieu of PrimeIcons (`<i class="pi pi-..">`) wherever a Figma
 * design calls for outline / regular Phosphor strokes.
 *
 *   <nas-icon name="upload-simple" />               -> 16×16
 *   <nas-icon name="upload-simple" [size]="24" />
 */
@Component({
  selector: 'nas-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-icon.component.html',
  styleUrl: './nas-icon.component.scss',
})
export class NasIconComponent {
  @Input({ required: true }) name!: string;
  @Input() size = 16;
  @Input() alt?: string;

  get cssUrl(): string {
    return `url('assets/icons/phosphor/${this.name}.svg')`;
  }
}
