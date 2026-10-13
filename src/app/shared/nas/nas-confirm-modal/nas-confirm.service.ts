import { Injectable, signal } from '@angular/core';

export interface NasConfirmOptions {
  title: string;
  message: string;
  /** Defaults to "Yes, Delete" when `danger`, else "Confirm". */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** A destructive action: the confirm button turns red. Default true. */
  danger?: boolean;
}

interface PendingConfirm extends NasConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * One confirmation for the whole Dashboard, drawn by <nas-confirm-host> in
 * the admin layout with the design-system modal (Figma 453:37969). Replaces
 * the PrimeNG confirm dialogs, which looked different and, mounted both in
 * the layout and in pages, could open twice.
 *
 *   if (await this.confirmDialog.ask({ title, message })) { ...delete... }
 */
@Injectable({ providedIn: 'root' })
export class NasConfirmService {
  private readonly pending = signal<PendingConfirm | null>(null);
  readonly request = this.pending.asReadonly();

  /** Resolves true when confirmed, false when cancelled or replaced. */
  ask(options: NasConfirmOptions): Promise<boolean> {
    this.pending()?.resolve(false);
    return new Promise<boolean>(resolve => this.pending.set({ danger: true, ...options, resolve }));
  }

  settle(confirmed: boolean): void {
    const current = this.pending();
    if (!current) return;
    this.pending.set(null);
    current.resolve(confirmed);
  }
}
