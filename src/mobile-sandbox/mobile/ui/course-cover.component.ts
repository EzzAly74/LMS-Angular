import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Square course cover used across the list, detail and learning screens.
 * Shows the real image when present; otherwise falls back to the Figma
 * dark-teal tile with a faint radar/target glyph (deterministic tint per
 * course so cards look varied like the mockups).
 */
@Component({
  selector: 'sbx-course-cover',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cc" [style.width.px]="size" [style.height.px]="size" [style.borderRadius.px]="radius">
      @if (image) {
        <img class="cc__img" [src]="image" alt="" />
      } @else {
        <div class="cc__ph" [style.background]="tint">
          <svg class="cc__glyph" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="44" stroke="rgba(212,245,255,.5)" stroke-width="1.5"/>
            <circle cx="50" cy="50" r="30" stroke="rgba(212,245,255,.4)" stroke-width="1.5"/>
            <circle cx="50" cy="50" r="16" stroke="rgba(212,245,255,.4)" stroke-width="1.5"/>
            <path d="M50 2v96M2 50h96M16 16l68 68M84 16 16 84" stroke="rgba(212,245,255,.25)" stroke-width="1"/>
          </svg>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: inline-block; }
      .cc { overflow: hidden; flex: none; }
      .cc__img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .cc__ph { width: 100%; height: 100%; position: relative; }
      .cc__glyph { position: absolute; left: 18%; top: 14%; width: 110%; height: 110%; }
    `,
  ],
})
export class CourseCoverComponent {
  @Input() image?: string | null;
  @Input() size = 64;
  @Input() radius = 12;
  /** Used to derive a stable fallback tint. */
  @Input() seed = 0;

  private readonly tints = ['#0c2427', '#496e91', '#ebd4a6', '#3a5a5c', '#5b6e8c'];

  get tint(): string {
    return this.tints[Math.abs(this.seed) % this.tints.length];
  }
}
