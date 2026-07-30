import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import {
  NasPageHeaderComponent,
  NasPillTabsComponent,
  NasPillTab,
  NasShimmerComponent,
} from '../../../../shared/nas';

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

@Component({
  selector: 'app-messages-list',
  standalone: true,
  imports: [
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './messages-list.component.html',
  styleUrl: './messages-list.component.scss',
})
export class MessagesListComponent implements OnInit {
  private api = inject(ApiService);
  private enums = inject(EnumsService);
  private fb = inject(FormBuilder);
  private toast = inject(MessageService);
  private t = inject(TranslateService);

  readonly TITLE_MAX = 191;

  constructor() {
    withLocaleReload(() => {
      this.load();
      this.loadRecipients();
    });
  }

  /* ── List state ────────────────────────────────────────────────────── */
  items = signal<Conversation[]>([]);
  loading = signal(true);
  activeTab = signal<InboxTab>('unread');
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

  /* ── Compose dialog ────────────────────────────────────────────────── */
  showCompose = signal(false);
  saving = signal(false);
  catalog = signal<CatalogGroup[]>([]);
  recipientSearch = signal('');
  activeChip = signal<string>('all'); // 'all' | 'learner' | 'role:<id>'
  private selected = signal<Set<string>>(new Set());
  private allFlags = signal<Set<string>>(new Set());

  composeForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(this.TITLE_MAX)]],
    message: ['', [Validators.required]],
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
    this.load();
    this.loadRecipients();
  }

  /* ── Data ──────────────────────────────────────────────────────────── */
  load(): void {
    this.loading.set(true);
    this.api.get<Conversation[]>(API.CONVERSATIONS, { tab: this.activeTab() }).subscribe({
      next: (res) => {
        this.items.set(Array.isArray(res.result) ? res.result : []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadRecipients(): void {
    this.api.get<CatalogGroup[]>(API.MESSAGES_RECIPIENTS).subscribe({
      next: (res) => this.catalog.set(res.result ?? []),
    });
  }

  setTab(t: string): void {
    this.activeTab.set(t as InboxTab);
    this.load();
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
        this.load();
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
    this.allFlags.set(new Set());
    this.showCompose.set(true);
  }

  isSelected(uid: string): boolean { return this.selected().has(uid); }

  toggleEntry(entry: ComposeEntry, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(entry.uid);
    else {
      next.delete(entry.uid);
      const flags = new Set(this.allFlags());
      if (entry.type === 'learner') flags.delete('learner');
      else for (const r of entry.roleIds) flags.delete(`role:${r}`);
      this.allFlags.set(flags);
    }
    this.selected.set(next);
  }

  isGroupAllChecked(): boolean {
    const chip = this.activeChip();
    if (chip === 'all') {
      const entries = this.entries();
      return entries.length > 0 && entries.every((e) => this.selected().has(e.uid));
    }
    return this.allFlags().has(chip);
  }

  toggleGroupAll(checked: boolean): void {
    const chip = this.activeChip();
    const next = new Set(this.selected());
    const flags = new Set(this.allFlags());
    const targets =
      chip === 'all'
        ? this.entries()
        : this.entries().filter((e) =>
            chip === 'learner'
              ? e.type === 'learner'
              : e.type === 'admin' && e.roleIds.includes(Number(chip.slice(5))),
          );
    for (const e of targets) {
      if (checked) next.add(e.uid);
      else next.delete(e.uid);
    }
    if (chip === 'all') {
      flags.clear();
      if (checked) {
        flags.add('learner');
        for (const g of this.catalog()) if (g.type === 'role') flags.add(`role:${g.role_id}`);
      }
    } else if (checked) {
      flags.add(chip);
    } else {
      flags.delete(chip);
    }
    this.selected.set(next);
    this.allFlags.set(flags);
  }

  /** Resolve the current selection to a flat recipient list (fan-out). */
  private buildRecipients(): Array<{ type: 'learner' | 'admin'; id: number }> {
    const flags = this.allFlags();
    const selected = this.selected();
    const out = new Map<string, { type: 'learner' | 'admin'; id: number }>();
    for (const g of this.catalog()) {
      if (g.type === 'learner') {
        const ids = flags.has('learner')
          ? g.members.map((m) => m.id)
          : g.members.filter((m) => selected.has(`learner:${m.id}`)).map((m) => m.id);
        for (const id of ids) out.set(`learner:${id}`, { type: 'learner', id });
      } else if (g.role_id != null) {
        const chipId = `role:${g.role_id}`;
        const ids = flags.has(chipId)
          ? g.members.map((m) => m.id)
          : g.members.filter((m) => selected.has(`admin:${m.id}`)).map((m) => m.id);
        for (const id of ids) out.set(`admin:${id}`, { type: 'admin', id });
      }
    }
    return [...out.values()];
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
          this.toast.add({ severity: 'success', detail: this.t.instant('messages_list_toasts.sent') });
          this.showCompose.set(false);
          this.saving.set(false);
          this.activeTab.set('sent');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }
}
