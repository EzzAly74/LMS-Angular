import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  signal,
} from '@angular/core';

export type NasAvatarSize = 'sm' | 'md' | 'lg';

/**
 * A person's photo, or the first letter of their name when there is no photo
 * or it fails to load. The one avatar of the Dashboard: lists, drawers,
 * profiles and the sidebar footer all render through it.
 *
 * The bubble colour is derived from the name over NAS tokens; a screen whose
 * Figma frame fixes it sets `--nas-avatar-bg` / `--nas-avatar-fg` on the host.
 */
@Component({
  selector: 'nas-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-avatar.component.html',
  styleUrl:    './nas-avatar.component.scss',
})
export class NasAvatarComponent {
  /** NAS design tokens used as deterministic avatar background palette. */
  private static readonly PALETTE: readonly string[] = [
    'var(--nas-teal-600)',
    'var(--nas-teal-700)',
    'var(--nas-sky-700)',
    'var(--nas-sky-600)',
    'var(--nas-status-green-500)',
    'var(--nas-status-amber-500)',
    'var(--nas-neutral-900)',
    'var(--nas-teal-800)',
  ];

  private static readonly PX: Readonly<Record<NasAvatarSize, number>> = { sm: 28, md: 36, lg: 48 };

  private readonly _name   = signal<string>('');
  private readonly _image  = signal<string | null>(null);
  private readonly _size   = signal<NasAvatarSize | number>('md');
  /** The image URL that failed to load, so a new URL is tried again. */
  private readonly failed  = signal<string | null>(null);

  /** The person's name, already in the UI language. */
  @Input() set name(v: string | null | undefined) { this._name.set((v ?? '').trim()); }
  /** Absolute photo URL; empty or missing shows the initial. */
  @Input() set image(v: string | null | undefined) { this._image.set(v || null); }
  /** A preset or a side length in CSS pixels. */
  @Input() set size(v: NasAvatarSize | number) { this._size.set(v); }
  /**
   * The name is shown next to the avatar, so the photo adds nothing for a
   * screen reader (alt=""). Set false where the avatar stands alone.
   */
  @Input() decorative = true;
  /** Above the fold (header, sidebar): load at once instead of lazily. */
  @Input() eager = false;

  protected readonly px = computed(() => {
    const s = this._size();
    return typeof s === 'number' ? s : NasAvatarComponent.PX[s];
  });

  protected readonly fontPx = computed(() => Math.round(this.px() * 0.4));

  protected readonly src = computed(() => {
    const image = this._image();
    return image && image !== this.failed() ? image : null;
  });

  protected readonly alt = computed(() => (this.decorative ? '' : this._name()));

  /** First letter of the name (a whole code point, so Arabic and emoji-safe). */
  protected readonly initial = computed(() => {
    const first = Array.from(this._name())[0];
    return first ? first.toLocaleUpperCase() : '?';
  });

  protected readonly bg = computed(() => {
    const palette = NasAvatarComponent.PALETTE;
    const n = this._name() || '?';
    const code = n.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return palette[code % palette.length];
  });

  protected onError(): void {
    this.failed.set(this._image());
  }
}
