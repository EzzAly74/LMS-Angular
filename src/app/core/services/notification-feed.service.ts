import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { API } from '../constants/api.constants';

/**
 * Shape returned by `GET /api/v1/notifications/mine` (NotificationInboxResource).
 * `title` / `body` are already localized server-side via `Accept-Language`.
 */
export interface FeedNotification {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  meta: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

/**
 * Single source of truth for the current user's personal notification feed
 * (event-driven notifications + per-recipient broadcast copies). Shared by
 * the notifications drawer (full list + compose) and the dashboard
 * notif-card (preview) so marking one read updates both surfaces at once —
 * no duplicate fetching, no stale card.
 */
@Injectable({ providedIn: 'root' })
export class NotificationFeedService {
  private readonly api = inject(ApiService);

  readonly items = signal<FeedNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);

  /** Fetch the latest page of the feed + refresh the unread badge. */
  load(perPage = 20): void {
    this.loading.set(true);
    this.api
      .getPaginated<FeedNotification>(API.NOTIFICATIONS_MINE, { per_page: perPage, page: 1 })
      .subscribe({
        next: (res) => {
          this.items.set(res.result.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    this.refreshUnread();
  }

  refreshUnread(): void {
    this.api
      .get<{ count: number }>(API.NOTIFICATIONS_MINE_UNREAD_COUNT)
      .subscribe({ next: (res) => this.unreadCount.set(res.result.count) });
  }

  /** Optimistically mark one item read (badge + row update, then persist). */
  markRead(item: FeedNotification): void {
    if (item.read_at) return;
    this.api.post(API.notificationMarkRead(item.id), {}).subscribe({
      next: () => {
        const now = new Date().toISOString();
        this.items.update((list) =>
          list.map((i) => (i.id === item.id ? { ...i, read_at: now } : i)),
        );
        this.unreadCount.update((c) => Math.max(0, c - 1));
      },
    });
  }

  markAllRead(): void {
    if (!this.unreadCount()) return;
    this.api.post(API.NOTIFICATIONS_MINE_READ_ALL, {}).subscribe({
      next: () => {
        const now = new Date().toISOString();
        this.items.update((list) => list.map((i) => ({ ...i, read_at: i.read_at ?? now })));
        this.unreadCount.set(0);
      },
    });
  }
}
