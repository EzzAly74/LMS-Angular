import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  ViewChild,
  forwardRef,
  signal,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NasIconComponent } from './nas-icon.component';

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
  template: `
    <div class="rte" [class.rte--disabled]="disabled()">
      <div class="rte__bar">
        <button type="button" class="rte__btn" (click)="exec('undo')" [attr.aria-label]="'Undo'"   tabindex="-1">
          <nas-icon name="arrow-counter-clockwise" [size]="16" />
        </button>
        <button type="button" class="rte__btn" (click)="exec('redo')" [attr.aria-label]="'Redo'"   tabindex="-1">
          <nas-icon name="arrow-clockwise" [size]="16" />
        </button>

        <span class="rte__divider"></span>

        <button type="button" class="rte__btn rte__btn--dropdown" (click)="cycleBlock()" tabindex="-1">
          <span class="rte__btn-label">{{ blockLabel() }}</span>
          <nas-icon name="caret-down" [size]="12" />
        </button>

        <button type="button" class="rte__btn rte__btn--colour" (click)="cycleColour()" tabindex="-1">
          <span class="rte__colour-chip" [style.background]="colour()"></span>
          <nas-icon name="caret-down" [size]="12" />
        </button>

        <span class="rte__divider"></span>

        <button type="button" class="rte__btn rte__btn--text"
                (click)="exec('bold')"           [attr.aria-label]="'Bold'"          tabindex="-1">
          <nas-icon name="text-b" [size]="16" />
        </button>
        <button type="button" class="rte__btn rte__btn--text"
                (click)="exec('italic')"         [attr.aria-label]="'Italic'"        tabindex="-1">
          <nas-icon name="text-italic" [size]="16" />
        </button>
        <button type="button" class="rte__btn rte__btn--text"
                (click)="exec('underline')"      [attr.aria-label]="'Underline'"     tabindex="-1">
          <nas-icon name="text-underline" [size]="16" />
        </button>
        <button type="button" class="rte__btn rte__btn--text"
                (click)="exec('strikeThrough')"  [attr.aria-label]="'Strikethrough'" tabindex="-1">
          <nas-icon name="text-strikethrough" [size]="16" />
        </button>

        <span class="rte__divider"></span>

        <button type="button" class="rte__btn" (click)="linkPrompt()" [attr.aria-label]="'Insert link'" tabindex="-1">
          <nas-icon name="link" [size]="16" />
        </button>
        <button type="button" class="rte__btn" (click)="exec('formatBlock', 'pre')" [attr.aria-label]="'Code'" tabindex="-1">
          <nas-icon name="code" [size]="16" />
        </button>

        <span class="rte__divider"></span>

        <button type="button" class="rte__btn" (click)="exec('insertUnorderedList')"
                [attr.aria-label]="'Bullet list'" tabindex="-1">
          <nas-icon name="list-bullets" [size]="16" />
        </button>
        <button type="button" class="rte__btn" (click)="exec('insertOrderedList')"
                [attr.aria-label]="'Numbered list'" tabindex="-1">
          <nas-icon name="list-numbers" [size]="16" />
        </button>
      </div>

      <div
        #editor
        class="rte__area"
        contenteditable="true"
        spellcheck="true"
        [attr.data-placeholder]="placeholder"
        (input)="onInput()"
        (blur)="onBlur()"
      ></div>
    </div>
  `,
  styleUrl: './nas-rich-text.component.scss',
})
export class NasRichTextComponent implements ControlValueAccessor, AfterViewInit {
  @ViewChild('editor', { static: true }) editorRef!: ElementRef<HTMLDivElement>;

  @Input() placeholder = '';

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

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};
  private pendingValue: string | null = null;

  ngAfterViewInit(): void {
    if (this.pendingValue !== null) {
      this.editorRef.nativeElement.innerHTML = this.pendingValue;
      this.pendingValue = null;
    }
  }

  /* ── ControlValueAccessor ─────────────────────────────────── */
  writeValue(value: string | null): void {
    const html = value ?? '';
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
    this.onChange(this.editorRef.nativeElement.innerHTML);
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
