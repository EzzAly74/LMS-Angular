import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Message, MessageService } from 'primeng/api';

export type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

export interface ToastOptions {
  /** i18n key or text; defaults to the severity's title ("Success", "Something went wrong"). */
  readonly title?: string;
  /** Interpolation params for the message and title keys. */
  readonly params?: Record<string, unknown>;
  /** Milliseconds on screen; defaults per severity (errors stay longest). */
  readonly life?: number;
  /** Stays until dismissed. */
  readonly sticky?: boolean;
}

/** How long each kind of toast stays: long enough to read, errors longest. */
export const TOAST_LIFE: Readonly<Record<ToastSeverity, number>> = {
  success: 4000,
  info: 5000,
  warn: 6000,
  error: 7000,
};

const SEVERITIES: readonly string[] = ['success', 'info', 'warn', 'error'];

/**
 * The app's MessageService (D-072), provided once at the root in place of
 * PrimeNG's. Every toast - from ToastService, the HTTP error interceptor or an
 * older direct `add()` - is normalised here, so none can look different:
 * a known severity, the severity's title when none is given, and the
 * severity's life. The single <nas-toaster> renders them.
 */
@Injectable()
export class NasMessageService extends MessageService {
  private readonly t = inject(TranslateService);

  override add(message: Message): void {
    super.add(this.normalise(message));
  }

  override addAll(messages: Message[]): void {
    super.addAll(messages.map(m => this.normalise(m)));
  }

  private normalise(m: Message): Message {
    const severity = (SEVERITIES.includes(m.severity ?? '') ? m.severity : 'info') as ToastSeverity;
    return {
      ...m,
      severity,
      summary: m.summary || this.t.instant(`toast.${severity}`),
      life: m.life ?? TOAST_LIFE[severity],
    };
  }
}

/**
 * The one way to show a toast. Messages and titles are i18n keys (or text
 * that is already translated, such as a server message - an unknown key
 * translates to itself):
 *
 *   toast.success('qualifications.deleted');
 *   toast.error(serverMessage);
 *   toast.success('qualifications.transfer.imported', { params: { count } });
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messages = inject(MessageService);
  private readonly t = inject(TranslateService);

  success(message: string, options?: ToastOptions): void { this.show('success', message, options); }
  info(message: string, options?: ToastOptions): void { this.show('info', message, options); }
  warn(message: string, options?: ToastOptions): void { this.show('warn', message, options); }
  error(message: string, options?: ToastOptions): void { this.show('error', message, options); }

  clear(): void { this.messages.clear(); }

  private show(severity: ToastSeverity, message: string, options: ToastOptions = {}): void {
    this.messages.add({
      severity,
      summary: options.title ? this.text(options.title, options.params) : undefined,
      detail: this.text(message, options.params),
      life: options.life,
      sticky: options.sticky,
    });
  }

  private text(keyOrText: string, params?: Record<string, unknown>): string {
    return keyOrText ? this.t.instant(keyOrText, params) : '';
  }
}
