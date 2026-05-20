import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type NasProgressTone = 'auto' | 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'nas-progress',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-progress.component.html',
  styleUrl:    './nas-progress.component.scss',
})
export class NasProgressComponent {
  private readonly _value = signal(0);

  @Input() set value(v: number | null | undefined) { this._value.set(v ?? 0); }
  @Input() tone: NasProgressTone = 'auto';
  @Input() showValue = true;

  protected readonly clamped = computed(() =>
    Math.max(0, Math.min(100, Math.round(this._value())))
  );

  protected readonly resolvedTone = computed<NasProgressTone>(() => {
    if (this.tone !== 'auto') return this.tone;
    const v = this.clamped();
    if (v >= 70) return 'success';
    if (v >= 40) return 'info';
    if (v >= 20) return 'warning';
    return 'danger';
  });
}
