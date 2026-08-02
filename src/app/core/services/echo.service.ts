import { Injectable, OnDestroy, effect, inject } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Single Reverb/Echo connection for the dashboard, rebuilt whenever the
 * auth token changes (login → connect with the fresh Bearer token; logout →
 * disconnect). Backed by the same `identity.{type}.{id}` / `conversation.{id}`
 * private channels the backend authorizes in `routes/channels.php` — see
 * `MessageService::broadcastMessage()`.
 */
@Injectable({ providedIn: 'root' })
export class EchoService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private echo: Echo<'reverb'> | null = null;

  constructor() {
    effect(() => {
      const token = this.auth.token();
      this.teardown();
      if (token) this.echo = this.buildConnection(token);
    });
  }

  /** Subscribe to a private channel by its bare name (no `private-` prefix). */
  channel(name: string) {
    return this.echo?.private(name) ?? null;
  }

  leave(name: string): void {
    this.echo?.leave(name);
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  private buildConnection(token: string): Echo<'reverb'> {
    return new Echo({
      broadcaster: 'reverb',
      key: environment.reverb.key,
      wsHost: environment.reverb.host,
      wsPort: environment.reverb.port,
      wssPort: environment.reverb.port,
      forceTLS: environment.reverb.scheme === 'https' || environment.reverb.scheme === 'wss',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: `${environment.apiBaseUrl}/api/broadcasting/auth`,
      auth: { headers: { Authorization: `Bearer ${token}` } },
      Pusher,
    });
  }

  private teardown(): void {
    this.echo?.disconnect();
    this.echo = null;
  }
}
