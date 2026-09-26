import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type EvTileTone = 'amber' | 'teal' | 'sky';

/**
 * A header tile of the Evaluation detail pages - Figma 2169:108198,
 * 2169:108801, 2169:109264: a 44px tinted icon box, a 32px value, a caption.
 *
 * `danger` paints the value red, as the failing-result frame (2169:109264)
 * does for a score below the pass limit; `suffix` stays in the default colour
 * ("2.3" red, "/5.0" not).
 *
 * The average-score tile's icon is drawn in Figma as a "⭐" emoji (FG-04);
 * callers pass the file's own Icons/Fill/star instead (rule 5).
 */
@Component({
  selector: 'ev-stat-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="st">
      <span class="st__icon st__icon--{{ tone() }}" aria-hidden="true">
        <img [src]="icon()" [attr.width]="iconSize()" [attr.height]="iconSize()" alt="" />
      </span>
      <div class="st__text">
        <p class="st__value">
          <bdi [attr.dir]="valueDir()"><span [class.st__danger]="danger()">{{ value() }}</span>@if (suffix()) {<span>{{ suffix() }}</span>}</bdi>
        </p>
        <p class="st__label">{{ label() }}</p>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; min-inline-size: 0; }
    .st {
      display: flex;
      align-items: center;
      gap: var(--nas-space-4);
      block-size: 100%;
      min-block-size: 111px;
      padding: 17px 21px;
      border: 1px solid var(--nas-color-border);
      border-radius: var(--nas-radius-xl);
      background: var(--nas-color-bg-surface);
      box-shadow: 0 1px 1px 0 var(--nas-teal-1000-08);
    }
    .st__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      inline-size: 44px;
      block-size: 44px;
      border: 1px solid;
      border-radius: var(--nas-radius-lg);
    }
    .st__icon img { display: block; }
    .st__icon--amber { background: rgba(235, 212, 166, 0.4); border-color: var(--nas-status-operational-3); }
    .st__icon--teal  { background: rgba(123, 174, 161, 0.3); border-color: var(--nas-status-operational-5); }
    .st__icon--sky   { background: var(--nas-sky-200); border-color: var(--nas-status-operational-2); }
    .st__text { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; }
    .st__value {
      margin: 0;
      font-size: var(--nas-size-2xl);
      line-height: 35.2px;
      font-weight: var(--nas-weight-bold);
      color: var(--nas-color-text-strong);
      overflow-wrap: anywhere;
    }
    .st__danger { color: var(--nas-status-red-500); }
    .st__label { margin: 0; font-size: var(--nas-size-2xs); line-height: 18px; color: var(--nas-color-text-muted); }
    @media (max-width: 480px) {
      .st { min-block-size: 0; padding: var(--nas-space-4); }
      .st__value { font-size: var(--nas-size-xl); line-height: 28px; }
    }
  `,
})
export class EvStatTileComponent {
  readonly icon     = input.required<string>();
  readonly iconSize = input(20);
  readonly tone     = input<EvTileTone>('teal');
  readonly value    = input.required<string>();
  readonly suffix   = input<string | null>(null);
  readonly label    = input.required<string>();
  readonly danger   = input(false);
  /** "ltr" for values like "4.3/5.0", so the slash does not flip in Arabic; set on a <bdi>, so alignment is kept. */
  readonly valueDir = input<'ltr' | 'auto' | null>(null);
}
