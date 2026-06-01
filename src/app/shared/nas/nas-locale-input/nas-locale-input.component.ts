import {
  ChangeDetectionStrategy,
  Component,
  Input,
  forwardRef,
  signal,
  booleanAttribute,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import type { LocalizedText } from '../../../core/models/localized.types';

const EMPTY: LocalizedText = { en: '', ar: '' };

@Component({
  selector: 'nas-locale-input',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-locale-input.component.html',
  styleUrl:    './nas-locale-input.component.scss',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => NasLocaleInputComponent),
    multi: true,
  }],
})
export class NasLocaleInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholderEn = '';
  @Input() placeholderAr = '';
  @Input({ transform: booleanAttribute }) required = false;
  @Input({ transform: booleanAttribute }) disabled = false;
  @Input({ transform: booleanAttribute }) multiline = false;
  @Input() inputId = `nas-locale-${Math.random().toString(36).slice(2, 9)}`;

  protected readonly value = signal<LocalizedText>({ ...EMPTY });
  protected readonly touched = signal(false);

  private onChange: (v: LocalizedText) => void = () => {};
  private onTouched: () => void = () => {};

  protected showError(): boolean {
    return this.touched() && this.required && !(this.value().en ?? '').trim();
  }

  protected onInput(lang: 'en' | 'ar', ev: Event): void {
    const text = (ev.target as HTMLInputElement).value;
    const next = { ...this.value(), [lang]: text };
    this.value.set(next);
    this.onChange(next);
  }

  writeValue(v: LocalizedText | null): void {
    this.value.set(v?.en || v?.ar ? { en: v.en ?? '', ar: v.ar ?? '' } : { ...EMPTY });
  }

  registerOnChange(fn: (v: LocalizedText) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}
