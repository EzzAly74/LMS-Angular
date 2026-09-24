import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  ViewChild,
  forwardRef,
  signal,
  AfterViewInit,
  SecurityContext,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { NasIconComponent } from '../nas-icon/nas-icon.component';

/**
 * Lightweight WYSIWYG editor matching the Figma "menu-bar" toolbar:
 *   ↺  ↻   |  Normal text ▾  | A▾ | B  I  U  S  | ⌬ ⟨/⟩ | ☷ ☰
 *
 * Implementation notes
 * ────────────────────
 * • Uses `contenteditable` + `document.execCommand`. Yes execCommand is
 *   marked deprecated, but it's still implemented in every shipping
 *   browser, has no replacement we'd realistically pull in here, and is
 *   pixel-cheap. The alternative — pulling in ngx-editor / Quill / TipTap —
 *   would balloon the bundle by tens of kB for a single CMS page.
 * • Acts as a `ControlValueAccessor`, so it plugs into any FormGroup the
 *   same way `pInputText` does.
 * • Output is HTML on the FormGroup value.
 */
@Component({
  selector: 'nas-rich-text',
  standalone: true,
  imports: [CommonModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NasRichTextComponent), multi: true }],
  templateUrl: './nas-rich-text.component.html',
  styleUrl: './nas-rich-text.component.scss',
})
export class NasRichTextComponent implements ControlValueAccessor, AfterViewInit {
  @ViewChild('editor', { static: true }) editorRef!: ElementRef<HTMLDivElement>;

  @Input() placeholder = '';
  /** Minimum height of the editable area — Figma module article uses ~138px. */
  @Input() areaMinHeight = '60px';

  disabled = signal(false);
  blockLabel = signal('Normal text');
  colour = signal('#000000');

  private readonly blocks: Array<{ tag: string; label: string }> = [
    { tag: 'P',  label: 'Normal text' },
    { tag: 'H1', label: 'Heading 1' },
    { tag: 'H2', label: 'Heading 2' },
    { tag: 'H3', label: 'Heading 3' },
    { tag: 'BLOCKQUOTE', label: 'Quote' },
  ];
  private blockIdx = 0;

  private readonly colours = ['#000000', '#F14437', '#F79008', '#0FB86A', '#2E7CF6', '#7C3AED'];
  private colourIdx = 0;

  private readonly sanitizer = inject(DomSanitizer);

  /**
   * Sanitise HTML before it reaches the DOM.
   *
   * DB-04 (High): this component assigned `element.innerHTML = value`
   * directly. Angular only sanitises the `[innerHTML]` *binding* — a direct
   * DOM assignment bypasses the sanitizer entirely, so any stored HTML coming
   * back from the API rendered unsanitised. That is a stored-XSS sink, and
   * with the bearer token sitting in localStorage (DB-03) it is a complete
   * account-takeover chain: inject a script into a CMS field, and every admin
   * who opens that record ships their token to the attacker.
   *
   * `DomSanitizer.sanitize(SecurityContext.HTML, …)` strips scripts, event
   * handlers and javascript: URLs while keeping the formatting markup this
   * editor produces (b/i/u/headings/lists/colour spans).
   */
  private sanitiseHtml(value: string | null): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, value ?? '') ?? '';
  }

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};
  private pendingValue: string | null = null;

  ngAfterViewInit(): void {
    if (this.pendingValue !== null) {
      this.editorRef.nativeElement.innerHTML = this.sanitiseHtml(this.pendingValue);
      this.pendingValue = null;
    }
  }

  /* ── ControlValueAccessor ─────────────────────────────────── */
  writeValue(value: string | null): void {
    const html = this.sanitiseHtml(value);
    if (this.editorRef?.nativeElement) {
      this.editorRef.nativeElement.innerHTML = html;
    } else {
      this.pendingValue = html;
    }
  }
  registerOnChange(fn: (val: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    if (this.editorRef?.nativeElement) {
      this.editorRef.nativeElement.setAttribute('contenteditable', isDisabled ? 'false' : 'true');
    }
  }

  /* ── Editing ──────────────────────────────────────────────── */
  onInput(): void {
    // Sanitise on the way out as well as in: contenteditable accepts pasted
    // markup, so without this an admin could paste a <script> and persist it
    // for everyone else to render.
    this.onChange(this.sanitiseHtml(this.editorRef.nativeElement.innerHTML));
  }
  onBlur(): void {
    this.onTouched();
  }

  exec(command: string, value?: string): void {
    this.editorRef.nativeElement.focus();
    document.execCommand(command, false, value);
    this.onInput();
  }

  cycleBlock(): void {
    this.blockIdx = (this.blockIdx + 1) % this.blocks.length;
    const b = this.blocks[this.blockIdx];
    this.blockLabel.set(b.label);
    this.exec('formatBlock', b.tag.toLowerCase());
  }

  cycleColour(): void {
    this.colourIdx = (this.colourIdx + 1) % this.colours.length;
    const c = this.colours[this.colourIdx];
    this.colour.set(c);
    this.exec('foreColor', c);
  }

  linkPrompt(): void {
    const url = prompt('Enter URL', 'https://');
    if (url) this.exec('createLink', url);
  }
}
