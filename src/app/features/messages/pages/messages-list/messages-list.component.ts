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
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { ApiService } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { MessageService } from 'primeng/api';
import {
  NasPageHeaderComponent,
  NasPillTabsComponent,
  NasPillTab,
  NasStatusBadgeComponent,
  NasShimmerComponent,
} from '../../../../shared/nas';

/* ── Models ──────────────────────────────────────────────────────────── */

interface RecipientGroupTag {
  type: 'learner' | 'role';
  role_id: number | null;
  label: string;
  all: boolean;
  count: number;
}

interface RecipientRef {
  id: number;
  name: string;
  kind: 'learner' | 'instructor' | 'admin';
  read_at?: string | null;
}

interface MessageItem {
  id: number;
  subject: string;
  body: string;
  preview?: string;
  created_at: string;
  sender?: { id: number; name: string } | null;
  is_read?: boolean | null;
  recipients_count?: number;
  read_count?: number;
  recipient_groups?: RecipientGroupTag[];
  recipients_summary?: string | null;
  recipients?: RecipientRef[];
}

/** A selectable recipient group returned by the compose catalog. */
interface CatalogMember {
  id: number;
  name: string;
}
interface CatalogGroup {
  key: string;
  type: 'learner' | 'role';
  role_id: number | null;
  label: string;
  members: CatalogMember[];
}

/** A flattened, de-duplicated selectable entry for the compose checklist. */
interface ComposeEntry {
  uid: string; // `learner:5` | `admin:12`
  id: number;
  name: string;
  type: 'learner' | 'admin';
  roleIds: number[]; // admin entries: every role chip they belong to
}

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
    NasStatusBadgeComponent,
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

  constructor() {
    withLocaleReload(() => {
      this.page = 1;
      this.load();
      this.loadRecipients();
    });
  }

  /* ── List state ────────────────────────────────────────────────────── */
  items = signal<MessageItem[]>([]);
  total = signal(0);
  loading = signal(true);
  activeTab = signal<InboxTab>('unread');

  page = 1;
  perPage = 50;
  readonly skeletonRows = [0, 1, 2, 3, 4];

  readonly TITLE_MAX = 191;

  tabs = computed<NasPillTab[]>(() =>
    this.enums
      .options('inbox_tab')()
      .map((o) => ({ id: o.code, label: o.value })),
  );

  /* ── Detail dialog ─────────────────────────────────────────────────── */
  showDetail = signal(false);
  selectedMessage = signal<MessageItem | null>(null);
  loadingDetail = signal(false);
  /** Whether the open message is shown from the "Sent" perspective. */
  detailIsSent = signal(false);

  /* ── Compose dialog ────────────────────────────────────────────────── */
  showCompose = signal(false);
  saving = signal(false);

  catalog = signal<CatalogGroup[]>([]);
  recipientSearch = signal('');
  activeChip = signal<string>('all'); // 'all' | 'learner' | 'role:<id>'

  /** Selected recipient uids. */
  private selected = signal<Set<string>>(new Set());
  /** "Select all" toggles, keyed by chip id ('learner' | 'role:<id>'). */
  private allFlags = signal<Set<string>>(new Set());

  composeForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(this.TITLE_MAX)]],
    message: ['', [Validators.required]],
  });

  get titleCtrl() {
    return this.composeForm.controls.title;
  }
  get messageCtrl() {
    return this.composeForm.controls.message;
  }

  /* ── Compose: derived data ─────────────────────────────────────────── */

  /** Flattened, de-duplicated selectable entries built from the catalog. */
  private entries = computed<ComposeEntry[]>(() => {
    const learners: ComposeEntry[] = [];
    const adminById = new Map<number, ComposeEntry>();

    for (const g of this.catalog()) {
      if (g.type === 'learner') {
        for (const m of g.members) {
          learners.push({
            uid: `learner:${m.id}`,
            id: m.id,
            name: m.name,
            type: 'learner',
            roleIds: [],
          });
        }
      } else if (g.role_id != null) {
        for (const m of g.members) {
          const existing = adminById.get(m.id);
          if (existing) {
            if (!existing.roleIds.includes(g.role_id)) existing.roleIds.push(g.role_id);
          } else {
            adminById.set(m.id, {
              uid: `admin:${m.id}`,
              id: m.id,
              name: m.name,
              type: 'admin',
              roleIds: [g.role_id],
            });
          }
        }
      }
    }

    return [...learners, ...adminById.values()];
  });

  /** Chips: All + Learners + one per role group (Figma order). */
  chips = computed(() => {
    const out: { id: string; label: string }[] = [
      { id: 'all', label: this.t.instant('common.all') },
    ];
    for (const g of this.catalog()) {
      out.push({ id: g.type === 'learner' ? 'learner' : `role:${g.role_id}`, label: g.label });
    }
    return out;
  });

  /** Entries visible under the active chip, filtered by the search term. */
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

  /** Label for the "select all" row of the active chip. */
  activeGroupLabel = computed(() => {
    const chip = this.activeChip();
    if (chip === 'all') return this.t.instant('common.all');
    const c = this.chips().find((x) => x.id === chip);
    return c?.label ?? '';
  });

  selectedCount = computed(() => this.selected().size);

  ngOnInit(): void {
    this.load();
    this.loadRecipients();
  }

  /* ── Data ──────────────────────────────────────────────────────────── */
  load(): void {
    this.loading.set(true);
    this.api
      .getPaginated<MessageItem>(API.MESSAGES, {
        page: this.page,
        per_page: this.perPage,
        tab: this.activeTab(),
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.result.data);
          this.total.set(res.result.total);
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

  /* ── Tabs ──────────────────────────────────────────────────────────── */
  setTab(t: string): void {
    this.page = 1;
    this.activeTab.set(t as InboxTab);
    this.load();
  }

  isSentTab = computed(() => this.activeTab() === 'sent');

  /* ── Open / read ───────────────────────────────────────────────────── */
  openMessage(m: MessageItem): void {
    this.detailIsSent.set(this.activeTab() === 'sent');
    this.selectedMessage.set(m);
    this.showDetail.set(true);
    this.refreshDetail(m.id);

    // Mark received messages read for the current admin on open.
    if (this.activeTab() !== 'sent' && m.is_read === false) {
      this.api.patch(API.messageRead(m.id)).subscribe({
        next: () => {
          this.items.update((list) =>
            list.map((x) => (x.id === m.id ? { ...x, is_read: true } : x)),
          );
        },
      });
    }
  }

  refreshDetail(id: number): void {
    this.loadingDetail.set(true);
    this.api.get<MessageItem>(`${API.MESSAGES}/${id}`).subscribe({
      next: (res) => {
        if (res.result) this.selectedMessage.set(res.result);
        this.loadingDetail.set(false);
      },
      error: () => this.loadingDetail.set(false),
    });
  }

  closeDetail(): void {
    this.showDetail.set(false);
    this.selectedMessage.set(null);
  }

  /* detail-popup helpers */
  allGroups(m: MessageItem): RecipientGroupTag[] {
    return (m.recipient_groups ?? []).filter((g) => g.all);
  }
  hasExplicitRecipients(m: MessageItem): boolean {
    return (m.recipient_groups ?? []).some((g) => !g.all);
  }
  recipientNames(m: MessageItem): string {
    return (m.recipients ?? []).map((r) => r.name).join('، ');
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

  /* selection helpers */
  isSelected(uid: string): boolean {
    return this.selected().has(uid);
  }

  toggleEntry(entry: ComposeEntry, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(entry.uid);
    else {
      next.delete(entry.uid);
      // unchecking a member drops any "all" flag for groups it belongs to
      this.clearAllFlagsFor(entry);
    }
    this.selected.set(next);
  }

  private clearAllFlagsFor(entry: ComposeEntry): void {
    const flags = new Set(this.allFlags());
    if (entry.type === 'learner') flags.delete('learner');
    else for (const r of entry.roleIds) flags.delete(`role:${r}`);
    this.allFlags.set(flags);
  }

  /** Whether the active chip's "select all" is on. */
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
      // toggle every group's "all" flag
      flags.clear();
      if (checked) {
        flags.add('learner');
        for (const g of this.catalog())
          if (g.type === 'role') flags.add(`role:${g.role_id}`);
      }
    } else if (checked) {
      flags.add(chip);
    } else {
      flags.delete(chip);
    }

    this.selected.set(next);
    this.allFlags.set(flags);
  }

  /** Build the `groups` payload from the current selection. */
  private buildGroups(): Array<{
    type: 'learner' | 'role';
    role_id?: number;
    all: boolean;
    ids?: number[];
  }> {
    const groups: Array<{ type: 'learner' | 'role'; role_id?: number; all: boolean; ids?: number[] }> = [];
    const flags = this.allFlags();
    const selected = this.selected();

    for (const g of this.catalog()) {
      if (g.type === 'learner') {
        if (flags.has('learner')) {
          groups.push({ type: 'learner', all: true });
        } else {
          const ids = g.members.filter((m) => selected.has(`learner:${m.id}`)).map((m) => m.id);
          if (ids.length) groups.push({ type: 'learner', all: false, ids });
        }
      } else if (g.role_id != null) {
        const chipId = `role:${g.role_id}`;
        if (flags.has(chipId)) {
          groups.push({ type: 'role', role_id: g.role_id, all: true });
        } else {
          const ids = g.members.filter((m) => selected.has(`admin:${m.id}`)).map((m) => m.id);
          if (ids.length) groups.push({ type: 'role', role_id: g.role_id, all: false, ids });
        }
      }
    }
    return groups;
  }

  send(): void {
    this.composeForm.markAllAsTouched();
    const groups = this.buildGroups();
    if (this.composeForm.invalid || groups.length === 0) return;

    this.saving.set(true);
    const v = this.composeForm.getRawValue();
    this.api
      .post(API.MESSAGES, {
        subject: v.title!,
        body: v.message!,
        groups,
      })
      .subscribe({
        next: () => {
          this.toast.add({
            severity: 'success',
            detail: this.t.instant('messages_list_toasts.sent'),
          });
          this.showCompose.set(false);
          this.saving.set(false);
          this.page = 1;
          this.activeTab.set('sent');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }
}
