import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NasIconComponent } from './nas-icon.component';

/**
 * Pixel-perfect Figma confirmation modal (node 453:37969 — "Log Out").
 *
 * Renders a centered 512px-wide card with three regions:
 *   - 65 px header  — bold title + close button
 *   - flexible body — a single paragraph of question / context
 *   - 77 px footer  — outlined cancel button + dark-filled confirm button
 *
 * The same shape is reused by:
 *   - Sidebar logout flow ("Log Out" / "Are you sure you want to logout?")
 *   - Destructive admin actions (delete category, etc.)
 *
 * Usage:
 *   <nas-confirm-modal
 *     [visible]="confirmOpen()"
 *     title="Log Out"
 *     message="Are you sure you want to logout?"
 *     confirmLabel="Yes, logout"
 *     cancelLabel="No, Keep it logged in"
 *     (confirm)="auth.logout()"
 *     (cancel)="confirmOpen.set(false)" />
 *
 * The two button slots are deliberately reversed (cancel left, confirm right)
 * to match the Figma layout. The "danger" tone (`danger=true`) swaps the
 * filled colour to a destructive red for destructive operations.
 */
@Component({
  selector: 'nas-confirm-modal',
  standalone: true,
  imports: [CommonModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-confirm-modal.component.html',
  styleUrl: './nas-confirm-modal.component.scss',
})
export class NasConfirmModalComponent {
  @Input({ required: true }) visible = false;
  @Input() title = 'Confirm';
  @Input() message = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() danger = false;
  @Input() busy = false;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

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
}
