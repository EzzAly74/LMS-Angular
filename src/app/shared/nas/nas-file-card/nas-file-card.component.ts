import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LocaleService } from '../../../core/services/locale.service';
import { NasDatePipe } from '../../pipes/nas-date.pipes';

/**
 * A stored file as a row: format badge, name, "size • date" (Figma
 * "Attachment Cards", 2393:121445; badges from "Attachments format",
 * 1983:44542). Clicking it asks the host to download - the host owns the
 * request, because files are served through authorized API routes.
 *
 * Figma draws PNG, DOC, PDF, JPG and XLS badges. PowerPoint has none (FG-43);
 * it uses PowerPoint's own orange. Anything else gets a neutral badge.
 */
@Component({
  selector: 'nas-file-card',
  standalone: true,
  imports: [TranslateModule, NasDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="fc" (click)="open.emit()" [disabled]="busy()"
      [attr.aria-busy]="busy()" [attr.aria-label]="'common.download_file' | translate: { name: name() }">
      <span class="fc__icon" aria-hidden="true">
        <img src="assets/icons/figma/file-page-28.svg" width="23" height="28" alt="" />
        <span class="fc__badge fc__badge--{{ format().tone }}">{{ format().label }}</span>
      </span>
      <span class="fc__text">
        <span class="fc__name"><bdi>{{ name() }}</bdi></span>
        <span class="fc__meta">
          <bdi dir="ltr">{{ sizeLabel() }}</bdi>
          @if (date(); as d) {
            <span class="fc__sep" aria-hidden="true">•</span><bdi>{{ d | nasDate: locale() }}</bdi>
          }
        </span>
      </span>
    </button>
  `,
  styles: [`
    :host { display: block; }
    .fc {
      display: flex;
      align-items: center;
      gap: var(--nas-space-4);
      inline-size: 100%;
      padding-block: var(--nas-space-2);
      padding-inline: var(--nas-space-4);
      border: 1px solid var(--nas-neutral-400);
      border-radius: var(--nas-radius-xs);
      background: #fdfdfd;
      font: inherit;
      text-align: start;
      cursor: pointer;
      &:hover:not(:disabled) { background: var(--nas-neutral-200); }
      &:focus-visible { outline: 2px solid var(--nas-teal-600); outline-offset: 2px; }
      &:disabled { cursor: progress; }
    }
    .fc__icon { position: relative; display: inline-flex; flex-shrink: 0; justify-content: center; inline-size: 28px; block-size: 28px; }
    .fc__badge {
      position: absolute;
      inset-inline: 1px;
      inset-block-start: 13px;
      border-radius: 1px;
      font-size: 9px;
      line-height: 11.7px;
      font-weight: var(--nas-weight-semibold);
      color: var(--nas-neutral-0);
      text-align: center;
      // Figma format colours: XLS Green, PDF Red, PNG Blue, JPG Purple, DOC.
      &--xls { background: #0f8105; }
      &--pdf { background: #f14848; }
      &--png { background: #4881f1; }
      &--jpg { background: #c548f1; }
      &--doc { background: #3197d7; }
      &--ppt { background: #d24726; }
      &--other { background: var(--nas-neutral-750); }
    }
    .fc__text { display: flex; flex: 1; flex-direction: column; gap: var(--nas-space-1); min-inline-size: 0; }
    .fc__name { font-size: var(--nas-size-xs); line-height: 16.8px; color: var(--nas-neutral-1000); overflow-wrap: anywhere; }
    .fc__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: var(--nas-size-2xs); line-height: 14.4px; color: #515151; }
    // A bullet, not a middle dot: next to Arabic-Indic digits "·" reads as "٠".
    .fc__sep { font-size: 8px; }
  `],
})
export class NasFileCardComponent {
  protected readonly locale = inject(LocaleService).locale;

  readonly name = input.required<string>();
  /** Bytes. */
  readonly size = input<number>(0);
  /** ISO date-time or Date; omitted when unknown. */
  readonly date = input<string | Date | null>(null);
  readonly busy = input(false);
  readonly open = output<void>();

  protected readonly format = computed(() => {
    const ext = (this.name().split('.').pop() ?? '').toLowerCase();
    const tone = ({ xls: 'xls', xlsx: 'xls', pdf: 'pdf', png: 'png', jpg: 'jpg', jpeg: 'jpg', doc: 'doc', docx: 'doc', ppt: 'ppt', pptx: 'ppt' } as Record<string, string>)[ext] ?? 'other';
    const label = tone === 'other' ? ext.slice(0, 4).toUpperCase() || '—' : tone.toUpperCase();
    return { tone, label };
  });

  protected readonly sizeLabel = computed(() => {
    const bytes = this.size();
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  });
}
