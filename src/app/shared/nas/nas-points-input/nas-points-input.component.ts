import {
  ChangeDetectionStrategy,
  Component,
  Input,
  booleanAttribute,
  forwardRef,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NasIconComponent } from '../nas-icon/nas-icon.component';

/**
 * Repeatable "points" editor (Figma 1032:59841 / 1032:61233) — a single
 * text input + "Add Point" action that appends into a removable list.
 * ControlValueAccessor over a `string[]`, so it drops into a reactive form
 * exactly like the qualifications checklist does (a flat array control).
 *
 * Used four times on the course dialog: What Students Will Learn (EN/AR)
 * and Course Requirements (EN/AR).
 */
@Component({
  selector: 'nas-points-input',
  standalone: true,
  imports: [TranslateModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-points-input.component.html',
  styleUrl: './nas-points-input.component.scss',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => NasPointsInputComponent),
    multi: true,
  }],
})
export class NasPointsInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = '';
  @Input({ transform: booleanAttribute }) disabled = false;

  protected readonly points = signal<string[]>([]);
  protected readonly draft = signal('');

  private onChange: (v: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  protected onDraftInput(ev: Event): void {
    this.draft.set((ev.target as HTMLInputElement).value);
  }

  /** Add the current draft as a point. Trims and ignores blanks/dupes. */
  protected add(): void {
    const text = this.draft().trim();
    if (!text) return;
    if (this.points().includes(text)) { this.draft.set(''); return; }
    const next = [...this.points(), text];
    this.points.set(next);
    this.draft.set('');
    this.onChange(next);
    this.onTouched();
  }

  protected onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      this.add();
    }
  }

  protected remove(index: number): void {
    const next = this.points().filter((_, i) => i !== index);
    this.points.set(next);
    this.onChange(next);
    this.onTouched();
  }

  writeValue(v: string[] | null): void {
    this.points.set(Array.isArray(v) ? v.filter(p => typeof p === 'string') : []);
  }

  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}
