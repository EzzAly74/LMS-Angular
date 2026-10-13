import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NasIconComponent } from '../nas-icon/nas-icon.component';

let nextId = 0;

/**
 * Pixel-perfect Figma confirmation modal (node 453:37969 — "Log Out").
 *
 * Renders a centered 512px-wide card with three regions:
 *   - 65 px header  — bold title + close button
 *   - flexible body — a single paragraph of question / context
 *   - 77 px footer  — outlined confirm button + dark-filled cancel button
 *
 * Used for logout, every delete (through NasConfirmService and
 * <nas-confirm-host>) and the other confirmations.
 *
 * The safe choice is the filled button and has focus on open; Tab stays
 * inside the card; Esc and the backdrop cancel; focus returns to the
 * control that opened it. `danger` turns the confirm button red and makes
 * the card an alertdialog.
 */
@Component({
  selector: 'nas-confirm-modal',
  standalone: true,
  imports: [CommonModule, NasIconComponent, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-confirm-modal.component.html',
  styleUrl: './nas-confirm-modal.component.scss',
})
export class NasConfirmModalComponent implements OnChanges, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  @Input({ required: true }) visible = false;
  @Input() title = 'Confirm';
  @Input() message = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() danger = false;
  @Input() busy = false;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  protected readonly uid = `nas-confirm-${nextId++}`;
  private opener: HTMLElement | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['visible']) return;
    if (this.visible) {
      const active = this.document.activeElement;
      this.opener = active instanceof HTMLElement ? active : null;
      // The safe (cancel) button takes focus once the card is drawn.
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.nas-confirm-btn--filled')?.focus());
    } else {
      this.restoreFocus();
    }
  }

  ngOnDestroy(): void {
    // A host that removes the modal (instead of setting visible=false) still
    // gives focus back.
    if (this.visible) this.restoreFocus();
  }

  onBackdropClick(): void {
    if (!this.busy) this.cancel.emit();
  }

  onConfirm(): void {
    if (!this.busy) this.confirm.emit();
  }

  onCancel(): void {
    if (!this.busy) this.cancel.emit();
  }

  /** Esc key closes the modal when it's open. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible && !this.busy) this.cancel.emit();
  }

  /** Keep Tab inside the card while it is open. */
  protected trapTab(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('.nas-confirm-card button:not([disabled])'),
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private restoreFocus(): void {
    const opener = this.opener;
    this.opener = null;
    if (opener?.isConnected) setTimeout(() => opener.focus());
  }
}
