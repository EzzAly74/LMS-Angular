import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  signal,
} from '@angular/core';

/**
 * Avatar with auto-derived background colour from the user's name.
 * Background palette references NAS design tokens — never raw hex values.
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

  private readonly _name = signal<string | null>(null);

  @Input() set name(v: string | null | undefined) {
    this._name.set(v ?? null);
  }
  @Input() src?: string | null;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  readonly displayName = this._name.asReadonly();

  protected readonly initials = computed(() => {
    const n = (this._name() ?? '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
  });

  protected readonly bg = computed(() => {
    const palette = NasAvatarComponent.PALETTE;
    const n = this._name() ?? '?';
    const code = n.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return palette[code % palette.length];
  });
}
