import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { Subscription, map } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { MessagesRealtimeService } from '../../../../core/services/messages-realtime.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import {
  NasPageHeaderComponent,
  NasPillTabsComponent,
  NasPillTab,
  NasShimmerComponent,
} from '../../../../shared/nas';
import { ToastService } from '../../../../core/services/toast.service';
import { NasCanDirective } from '../../../../shared/nas/nas-can/nas-can.directive';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasListStateComponent } from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { createPagedList, type PagedQuery } from '../../../../shared/list/paged-list';

/* ── Models (unified conversation store) ─────────────────────────────── */

interface Counterpart { name: string; image: string | null; role: string; }
interface LastMessage { body: string; created_at: string | null; mine: boolean; }
interface Conversation {
  id: number;
  subject: string | null;
  course: { id: number; title: string } | null;
  counterpart: Counterpart;
  last_message: LastMessage | null;
  unread_count: number;
  last_message_at: string | null;
}
interface ThreadMessage { id: number; body: string; mine: boolean; sender_name: string; created_at: string | null; }
interface ConversationThread { conversation: Conversation; messages: ThreadMessage[]; }

/* Compose recipient catalog (reuses /messages/recipients: learners + roles). */
interface CatalogMember { id: number; name: string; }
interface CatalogGroup { key: string; type: 'learner' | 'role'; role_id: number | null; label: string; members: CatalogMember[]; }
interface ComposeEntry { uid: string; id: number; name: string; type: 'learner' | 'admin'; roleIds: number[]; }

type InboxTab = 'unread' | 'received' | 'sent';

interface InboxQuery extends PagedQuery { readonly tab: InboxTab; }

/** Rows per inbox page (NEW2B-5905). */
const INBOX_PER_PAGE = 15;
/** The API's reply / broadcast body limit. */
const BODY_MAX = 5000;

@Component({
  selector: 'app-messages-list',
  standalone: true,
  imports: [
    NasCanDirective,
    CommonModule,
    TranslateModule,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    DialogModule,
    CheckboxModule,
    NasPageHeaderComponent,
    NasPillTabsComponent,
    NasShimmerComponent,
    NasPagerComponent,
    NasListStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './messages-list.component.html',
  styleUrl: './messages-list.component.scss',
})
export class MessagesListComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private enums = inject(EnumsService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private t = inject(TranslateService);
  private realtime = inject(MessagesRealtimeService);
  private realtimeSub?: Subscription;

  readonly TITLE_MAX = 191;
  readonly BODY_MAX = BODY_MAX;

  constructor() {
    withLocaleReload(() => {
      this.list.reload();
      this.loadRecipients();
    });

    // Chat should always open on the latest messages — re-run whenever the
    // thread is (re)loaded, a reply is sent, or a realtime push updates it.
    effect(() => {
      const count = this.thread()?.messages.length ?? 0;
      if (count === 0) return;
      setTimeout(() => this.scrollThreadToBottom());
    });
  }

  private scrollThreadToBottom(): void {
    const el = this.threadScroll()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  ngOnDestroy(): void {
    this.realtimeSub?.unsubscribe();
  }

  /* ── List state ────────────────────────────────────────────────────── */
  /** Server pages, newest first; the tab is filtered by the API before paging (NEW2B-5905). */
  readonly list = createPagedList<InboxQuery, Conversation>({
    initial: { search: '', page: 1, perPage: INBOX_PER_PAGE, tab: 'unread' },
    load: q =>
      this.api
        .getPaginated<Conversation>(API.CONVERSATIONS, { tab: q.tab, page: q.page, per_page: q.perPage })
        .pipe(map(res => ({ items: res.result.data, total: res.result.total }))),
  });
  activeTab = computed(() => this.list.query().tab);
  readonly skeletonRows = [0, 1, 2, 3, 4];

  tabs = computed<NasPillTab[]>(() =>
    this.enums.options('inbox_tab')().map((o) => ({ id: o.code, label: o.value })),
  );
  isSentTab = computed(() => this.activeTab() === 'sent');

  /* ── Thread dialog ─────────────────────────────────────────────────── */
  showThread = signal(false);
  thread = signal<ConversationThread | null>(null);
  loadingThread = signal(false);
  draftReply = signal('');
  replying = signal(false);
  private threadScroll = viewChild<ElementRef<HTMLDivElement>>('threadScroll');

  /* ── Compose dialog ────────────────────────────────────────────────── */
  showCompose = signal(false);
  saving = signal(false);
  catalog = signal<CatalogGroup[]>([]);
  recipientSearch = signal('');
  activeChip = signal<string>('all'); // 'all' | 'learner' | 'role:<id>'
  private selected = signal<Set<string>>(new Set());

  composeForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(this.TITLE_MAX)]],
    message: ['', [Validators.required, Validators.maxLength(BODY_MAX)]],
  });
  get titleCtrl() { return this.composeForm.controls.title; }
  get messageCtrl() { return this.composeForm.controls.message; }

  /** Flattened, de-duplicated selectable entries from the catalog. */
  private entries = computed<ComposeEntry[]>(() => {
    const learners: ComposeEntry[] = [];
    const adminById = new Map<number, ComposeEntry>();
    for (const g of this.catalog()) {
      if (g.type === 'learner') {
        for (const m of g.members) {
          learners.push({ uid: `learner:${m.id}`, id: m.id, name: m.name, type: 'learner', roleIds: [] });
        }
      } else if (g.role_id != null) {
        for (const m of g.members) {
          const existing = adminById.get(m.id);
          if (existing) {
            if (!existing.roleIds.includes(g.role_id)) existing.roleIds.push(g.role_id);
          } else {
            adminById.set(m.id, { uid: `admin:${m.id}`, id: m.id, name: m.name, type: 'admin', roleIds: [g.role_id] });
          }
        }
      }
    }
    return [...learners, ...adminById.values()];
  });

  chips = computed(() => {
    const out: { id: string; label: string }[] = [{ id: 'all', label: this.t.instant('common.all') }];
    for (const g of this.catalog()) {
      out.push({ id: g.type === 'learner' ? 'learner' : `role:${g.role_id}`, label: g.label });
    }
    return out;
  });

  visibleEntries = computed<ComposeEntry[]>(() => {
    const chip = this.activeChip();
    const term = this.recipientSearch().trim().toLowerCase();
    return this.entries().filter((e) => {
      if (chip === 'learner' && e.type !== 'learner') return false;
      if (chip.startsWith('role:')) {
        const roleId = Number(chip.slice(5));
        if (e.type !== 'admin' || !e.roleIds.includes(roleId)) return false;
      }
      return !term || e.name.toLowerCase().includes(term);
    });
  });

  activeGroupLabel = computed(() => {
    const chip = this.activeChip();
    if (chip === 'all') return this.t.instant('common.all');
    return this.chips().find((x) => x.id === chip)?.label ?? '';
  });
  selectedCount = computed(() => this.selected().size);

  ngOnInit(): void {
    this.list.reload();
    this.loadRecipients();

    // Realtime push (see MessagesRealtimeService) — refresh the list preview
    // for every incoming message, and live-append it if its thread is open.
    this.realtimeSub = this.realtime.messageReceived$.subscribe((payload) => {
      this.list.reload();
      if (this.thread()?.conversation.id === payload.conversation_id) {
        // The thread is already open — fetching it marks the conversation
        // read server-side, so the badge the realtime push just bumped
        // needs correcting back down immediately, not on next reopen.
        this.api.get<ConversationThread>(API.conversationThread(payload.conversation_id)).subscribe({
          next: (res) => {
            if (res.result) this.thread.set(res.result);
            this.realtime.refreshUnread();
          },
        });
      }
    });
  }

  /* ── Data ──────────────────────────────────────────────────────────── */
  loadRecipients(): void {
    this.api.get<CatalogGroup[]>(API.MESSAGES_RECIPIENTS).subscribe({
      next: (res) => this.catalog.set(res.result ?? []),
    });
  }

  setTab(t: string): void {
    this.list.patch({ tab: t as InboxTab });
  }

  /* ── Open thread / reply ───────────────────────────────────────────── */
  openConversation(c: Conversation): void {
    this.thread.set(null);
    this.draftReply.set('');
    this.showThread.set(true);
    this.loadingThread.set(true);
    this.api.get<ConversationThread>(API.conversationThread(c.id)).subscribe({
      next: (res) => {
        this.thread.set(res.result ?? null);
        this.loadingThread.set(false);
        this.list.reload();
        // Fetching the thread marks it read server-side — reflect that in
        // the sidebar badge right away instead of waiting for the next push.
        this.realtime.refreshUnread();
      },
      error: () => this.loadingThread.set(false),
    });
  }

  sendReply(): void {
    const t = this.thread();
    const body = this.draftReply().trim();
    if (!t || !body || this.replying()) return;
    this.replying.set(true);
    this.api.post<ConversationThread>(API.conversationReply(t.conversation.id), { body }).subscribe({
      next: (res) => {
        this.replying.set(false);
        if (res.result) this.thread.set(res.result);
        this.draftReply.set('');
      },
      error: () => this.replying.set(false),
    });
  }

  closeThread(): void {
    this.showThread.set(false);
    this.thread.set(null);
  }

  /* ── Compose ───────────────────────────────────────────────────────── */
  openCompose(): void {
    this.composeForm.reset({ title: '', message: '' });
    this.recipientSearch.set('');
    this.activeChip.set('all');
    this.selected.set(new Set());
    this.showCompose.set(true);
  }

  isSelected(uid: string): boolean { return this.selected().has(uid); }

  toggleEntry(entry: ComposeEntry, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(entry.uid);
    else next.delete(entry.uid);
    this.selected.set(next);
  }

  /**
   * "All" / "All <group>" ticks every row the list shows now: the chosen group
   * and the search together. It used to tick the whole group whatever the
   * search, so a search then "All" messaged everyone (NEW2B-5904).
   */
  isGroupAllChecked(): boolean {
    const visible = this.visibleEntries();
    const selected = this.selected();
    return visible.length > 0 && visible.every((e) => selected.has(e.uid));
  }

  toggleGroupAll(checked: boolean): void {
    const next = new Set(this.selected());
    for (const e of this.visibleEntries()) {
      if (checked) next.add(e.uid);
      else next.delete(e.uid);
    }
    this.selected.set(next);
  }

  /** The selection as a flat recipient list (one conversation each). */
  private buildRecipients(): Array<{ type: 'learner' | 'admin'; id: number }> {
    const selected = this.selected();
    return this.entries()
      .filter((e) => selected.has(e.uid))
      .map((e) => ({ type: e.type, id: e.id }));
  }

  send(): void {
    this.composeForm.markAllAsTouched();
    const recipients = this.buildRecipients();
    if (this.composeForm.invalid || recipients.length === 0) return;

    this.saving.set(true);
    const v = this.composeForm.getRawValue();
    this.api
      .post(API.CONVERSATIONS_BULK, { subject: v.title!, body: v.message!, recipients })
      .subscribe({
        next: () => {
          this.toast.success('messages_list_toasts.sent');
          this.showCompose.set(false);
          this.saving.set(false);
          this.list.patch({ tab: 'sent' });
        },
        error: () => this.saving.set(false),
      });
  }
}
