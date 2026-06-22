import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarModule } from 'primeng/sidebar';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { NasIconComponent } from '../nas-icon/nas-icon.component';
import { NotificationsDrawerService } from './notifications-drawer.service';
import { ApiService } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { LocaleService } from '../../../core/services/locale.service';
import { withLocaleReload } from '../../../core/utils/with-locale-reload';
import {
  pickLocalized,
  type MaybeLocalized,
} from '../../../core/utils/localized';

interface RecipientUser {
  id: number;
  name: string;
  machine_code: string | null;
  job_title?: string | null;
  learner_type?: string | null;
}

interface NotificationItem {
  id: number;
  title: MaybeLocalized;
  body: MaybeLocalized;
  for_public: boolean;
  created_at: string;
}

type RecipientRole = 'learner' | 'instructor';

/**
 * Right-edge `<p-sidebar>` notifications drawer (Figma 281:8104).
 *
 * Lives in the admin shell and is shown / hidden via
 * `NotificationsDrawerService`. Wraps three responsibilities:
 *
 *   1. List recent notifications from `/api/v1/notifications` (paginated).
 *   2. Compose a new notification — description, recipient role tabs
 *      (Learners / Instructors), recipient picker with `All` toggle, send.
 *   3. Push the created notification (admin-only API call).
 *
 * The recipient picker hits `/api/v1/users?role=learner|instructor` so
 * both tabs are fully dynamic; selecting `All <role>` switches the
 * payload to `for_public=true`, which the backend interprets as a
 * broadcast over the existing public-notification pipeline.
 */
@Component({
  selector: 'nas-notifications-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    SidebarModule,
    SkeletonModule,
    TranslateModule,
    NasIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications-drawer.component.html',
  styleUrl: './notifications-drawer.component.scss',
})
export class NotificationsDrawerComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly messages = inject(MessageService);
  private readonly localeSvc = inject(LocaleService);
  private readonly t = inject(TranslateService);
  readonly drawer = inject(NotificationsDrawerService);

  /** Bumped on every locale switch so `computed()` re-evaluates labels
   *  derived from `t.instant()`, which is not signal-tracked. */
  private readonly langTick = signal(0);

  /** Two-way bound to the p-sidebar `[(visible)]`. */
  visible = false;

  /* ── New-notification composer state ──────────────────────────────── */
  composerOpen = signal(true);
  description = signal('');
  saving = signal(false);

  recipientRole = signal<RecipientRole>('learner');
  recipientSearch$ = new Subject<string>();
  recipientSearch = signal('');

  recipients = signal<RecipientUser[]>([]);
  loadingRecipients = signal(false);

  /** Set of machine codes the admin has individually selected. */
  selectedCodes = signal<Set<string>>(new Set());

  /** When true, the "All <role>" checkbox is on → broadcast. */
  allSelected = signal(false);

  /* ── Notifications list state ─────────────────────────────────────── */
  notifications = signal<NotificationItem[]>([]);
  loadingList = signal(false);

  private readonly destroy$ = new Subject<void>();

  /* ── Derived ──────────────────────────────────────────────────────── */
  recipientRoleLabel = computed(() => {
    this.langTick();
    return this.recipientRole() === 'learner'
      ? this.t.instant('notifications.learners_upper')
      : this.t.instant('notifications.instructors_upper');
  });

  allLabel = computed(() => {
    this.langTick();
    return this.recipientRole() === 'learner'
      ? this.t.instant('notifications.all_learners')
      : this.t.instant('notifications.all_instructors');
  });

  canSend = computed(() => {
    if (this.saving()) return false;
    if (!this.description().trim()) return false;
    if (this.allSelected()) return true;
    return this.selectedCodes().size > 0;
  });

  constructor() {
    effect(
      () => {
        const open = this.drawer.isOpen();
        this.visible = open;
        if (open) {
          this.loadList();
          this.loadRecipients();
        }
      },
      { allowSignalWrites: true },
    );

    // Re-fetch both panels whenever the user toggles EN ↔ AR while the
    // drawer is open. The drawer can stay open across a language switch
    // (the language toggle lives in the same top bar), so without this
    // hook the notification list + recipient picker would render stale
    // translations until the user closed and re-opened the drawer.
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      if (!this.drawer.isOpen()) return;
      this.loadList();
      this.loadRecipients();
    });
  }

  ngOnInit(): void {
    this.recipientSearch$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((q) => {
        this.recipientSearch.set(q);
        this.loadRecipients();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── UI handlers ──────────────────────────────────────────────────── */
  onVisibleChange(open: boolean): void {
    if (!open) this.drawer.close();
  }

  toggleComposer(): void {
    this.composerOpen.update((v) => !v);
  }

  setRole(role: RecipientRole): void {
    if (this.recipientRole() === role) return;
    this.recipientRole.set(role);
    this.selectedCodes.set(new Set());
    this.allSelected.set(false);
    this.loadRecipients();
  }

  onRecipientSearch(term: string): void {
    this.recipientSearch$.next(term);
  }

  toggleAll(checked: boolean): void {
    this.allSelected.set(checked);
    if (checked) this.selectedCodes.set(new Set());
  }

  toggleRecipient(code: string | null, checked: boolean): void {
    if (!code) return;
    const next = new Set(this.selectedCodes());
    if (checked) {
      next.add(code);
      this.allSelected.set(false);
    } else {
      next.delete(code);
    }
    this.selectedCodes.set(next);
  }

  isRecipientSelected(code: string | null): boolean {
    return !!code && this.selectedCodes().has(code);
  }

  /* ── Data ─────────────────────────────────────────────────────────── */
  private loadRecipients(): void {
    this.loadingRecipients.set(true);
    const isInstructor = this.recipientRole() === 'instructor';

    // Instructors live in a separate table — use the dedicated endpoint.
    // Learners come from the users table via the general /users endpoint.
    const endpoint = isInstructor ? API.INSTRUCTORS : API.USERS;
    const params: Record<string, string | number | undefined> = {
      per_page: 100,
      page: 1,
      search: this.recipientSearch() || undefined,
    };
    if (!isInstructor) {
      params['role'] = 'learner';
    }

    this.api
      .getPaginated<RecipientUser>(endpoint, params)
      .subscribe({
        next: (res) => {
          // Instructors have no machine_code — use their id (as string) so the
          // existing selection logic (toggleRecipient / isRecipientSelected) works
          // without any changes. The send() method routes these ids as instructor_ids.
          const data = isInstructor
            ? res.result.data.map(u => ({ ...u, machine_code: String(u.id) }))
            : res.result.data;
          this.recipients.set(data);
          this.loadingRecipients.set(false);
        },
        error: () => this.loadingRecipients.set(false),
      });
  }

  private loadList(): void {
    this.loadingList.set(true);
    this.api
      .getPaginated<NotificationItem>(API.NOTIFICATIONS, {
        per_page: 20,
        page: 1,
      })
      .subscribe({
        next: (res) => {
          this.notifications.set(res.result.data);
          this.loadingList.set(false);
        },
        error: () => this.loadingList.set(false),
      });
  }

  /** Localised title/body fallback for translatable notification fields. */
  display(value: MaybeLocalized): string {
    const locale = this.localeSvc.locale() === 'ar' ? 'ar' : 'en';
    return pickLocalized(value, locale, '') || '';
  }

  /* ── Send ─────────────────────────────────────────────────────────── */
  send(): void {
    if (!this.canSend()) return;
    const description = this.description().trim();
    if (!description) return;

    /**
     * Backend expects the translatable `title` + `body` on every supported
     * locale. We don't have a separate title input in this drawer (Figma
     * design uses just a description), so we synthesise the title from a
     * trimmed prefix of the body — this keeps the existing notification
     * model unchanged while still surfacing something in the list.
     */
    const titleText =
      description.length > 60
        ? description.slice(0, 57).trimEnd() + '…'
        : description;

    const payload: Record<string, unknown> = {
      title: { en: titleText, ar: titleText },
      body: { en: description, ar: description },
    };

    if (this.allSelected()) {
      payload['for_public'] = true;
    } else {
      payload['for_public'] = false;
      const codes = Array.from(this.selectedCodes());
      if (this.recipientRole() === 'instructor') {
        // Instructors have no HR machine codes — send as instructor_ids (integers).
        // Backend stores them as DB records only; no HR push is attempted.
        payload['instructor_ids'] = codes.map(Number);
      } else {
        payload['user_codes'] = codes;
      }
    }

    this.saving.set(true);
    this.api.post(API.NOTIFICATIONS, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.description.set('');
        this.selectedCodes.set(new Set());
        this.allSelected.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Sent',
          detail: 'Notification dispatched.',
        });
        this.loadList();
      },
      error: () => this.saving.set(false),
    });
  }
}
