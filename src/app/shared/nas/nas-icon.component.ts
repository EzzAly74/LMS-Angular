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
  template: `<span class="nas-icon__mask"
                  [attr.aria-label]="alt || name"
                  role="img"
                  [style.--nas-icon-url]="cssUrl"
                  [style.width.px]="size"
                  [style.height.px]="size"></span>`,
  styles: [`
    :host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
    .nas-icon__mask {
      display: inline-block;
      background-color: currentColor;
      mask-image: var(--nas-icon-url);
      -webkit-mask-image: var(--nas-icon-url);
      mask-size: 100% 100%;
      -webkit-mask-size: 100% 100%;
      mask-repeat: no-repeat;
      -webkit-mask-repeat: no-repeat;
      mask-position: center;
      -webkit-mask-position: center;
      flex-shrink: 0;
    }
  `],
})
export class NasIconComponent {
  @Input({ required: true }) name!: string;
  @Input() size = 16;
  @Input() alt?: string;

  get cssUrl(): string {
    return `url('assets/icons/phosphor/${this.name}.svg')`;
  }
}
