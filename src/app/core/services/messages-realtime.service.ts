import { Injectable, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { EchoService } from './echo.service';
import { API } from '../constants/api.constants';

/** Payload shape of the `message.sent` broadcast — see App\Events\MessageSent. */
export interface MessageSentPayload {
  id: number;
  conversation_id: number;
  body: string;
  sender_type: 'User' | 'Instructor' | 'Admin';
  sender_id: number;
  sender_name: string;
  created_at: string | null;
  last_message_at: string | null;
}

/**
 * The dashboard's own inbox realtime feed — the nav badge count plus a push
 * stream any open messages screen can react to, so neither needs its own
 * 30s-poll timer. Scoped to the logged-in admin's own `identity.Admin.{id}`
 * channel (see routes/channels.php); a same-email instructor/admin sibling
 * account is picked up on the next normal fetch, not pushed live — the
 * dashboard only ever authenticates as an Admin (see AuthAdmin).
 */
@Injectable({ providedIn: 'root' })
export class MessagesRealtimeService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly echo = inject(EchoService);

  readonly unreadCount = signal(0);

  /** Emits every `message.sent` push not authored by the current admin. */
  readonly messageReceived$ = new Subject<MessageSentPayload>();

  private subscribedChannel: string | null = null;

  constructor() {
    effect(() => {
      const admin = this.auth.currentAdmin();
      this.unsubscribe();

      if (!admin) return;

      this.refreshUnread();

      const name = `identity.Admin.${admin.id}`;
      this.subscribedChannel = name;
      this.echo.channel(name)?.listen('.message.sent', (payload: MessageSentPayload) => {
        if (payload.sender_type === 'Admin' && payload.sender_id === admin.id) return;
        this.unreadCount.update((c) => c + 1);
        this.messageReceived$.next(payload);
      });
    });
  }

  refreshUnread(): void {
    this.api.get<{ count: number }>(API.CONVERSATIONS_UNREAD_COUNT).subscribe({
      next: (res) => this.unreadCount.set(res.result?.count ?? 0),
    });
  }

  private unsubscribe(): void {
    if (this.subscribedChannel) this.echo.leave(this.subscribedChannel);
    this.subscribedChannel = null;
  }
}
