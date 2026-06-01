import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NasIconComponent } from '../nas-icon/nas-icon.component';

/**
 * Pixel-perfect "Upload Photo / Replace Photo" panel from the Platform
 * Settings Figma. When `value` is empty the panel shows a centered upload
 * area with the cloud-arrow icon, accepted formats, max size, and a CTA
 * pill. When `value` holds a URL the panel renders a `Replace Photo` CTA
 * and emits a small thumbnail preview alongside.
 *
 * The component is presentation-only — it doesn't talk to the network. The
 * page wires `(fileSelected)` to an upload service and feeds the result
 * back through `[value]`.
 */
@Component({
  selector: 'nas-photo-upload',
  standalone: true,
  imports: [CommonModule, TranslateModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-photo-upload.component.html',
  styleUrl: './nas-photo-upload.component.scss',
})
export class NasPhotoUploadComponent {
  @Input() value: string | null = null;
  @Input() ratio?: string;
  @Input() formats = 'PNG, JPG, JPEG, WEBP, SVG, GIF';
  @Input() maxLabel = 'common.max_file_size_3mb';
  @Input() accept = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif';
  /**
   * Optional overrides for the CTA button label. Lets callers (e.g. the
   * Courses Add/Edit dialog) match Figma's "Add Photo / Replace Photo"
   * wording without leaking into the shared `platform_settings.*` keys.
   */
  @Input() addLabel?: string;
  @Input() replaceLabel?: string;

  @Output() fileSelected = new EventEmitter<File>();
  @Output() cleared = new EventEmitter<void>();

  fileName = signal<string | null>(null);
  private cd = inject(ChangeDetectorRef);

  onFileChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.fileSelected.emit(file);
    input.value = ''; // allow re-selecting the same file
    this.cd.markForCheck();
  }

  onClear(ev?: Event): void {
    ev?.stopPropagation();
    ev?.preventDefault();
    this.fileName.set(null);
    this.cleared.emit();
  }

  openPicker(ev: Event): void {
    const root = (ev.currentTarget as HTMLElement).closest('.photo-upload');
    root?.querySelector<HTMLInputElement>('.photo-upload__hidden')?.click();
  }
}
