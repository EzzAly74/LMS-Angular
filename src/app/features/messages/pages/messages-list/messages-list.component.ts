import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { MessageService } from 'primeng/api';
import {
  NasPageHeaderComponent,
  NasPillTabsComponent,
  NasPillTab,
  NasStatusBadgeComponent,
  NasAvatarComponent,
} from '../../../../shared/nas';

interface MessageItem {
  id: number;
  subject: string;
  body: string;
  preview?: string;
  recipients_count: number;
  read_count: number;
  recipients_text?: string;
  created_at: string;
  is_read?: boolean;
  resolved?: boolean;
}

interface UserOption {
  id: number;
  name: string;
  is_instructor?: boolean;
}

type InboxTab = 'all' | 'unread' | 'sent' | 'resolved';

@Component({
  selector: 'app-messages-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, FormsModule, ReactiveFormsModule, DatePipe,
    DialogModule, CheckboxModule,
    NasPageHeaderComponent, NasPillTabsComponent, NasStatusBadgeComponent, NasAvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './messages-list.component.html',
  styleUrl: './messages-list.component.scss',
})
export class MessagesListComponent implements OnInit {
  private api  = inject(ApiService);
  private fb   = inject(FormBuilder);
  private toast = inject(MessageService);

  items     = signal<MessageItem[]>([]);
  total     = signal(0);
  loading   = signal(true);
  activeTab = signal<InboxTab>('sent');
  userOptions = signal<UserOption[]>([]);

  showCompose = signal(false);
  showWelcome = signal(false);
  saving      = signal(false);

  recipientSearch = signal('');
  recipientFilter = signal<'all' | 'learners' | 'instructors'>('all');

  page = 1;
  perPage = 50;

  tabs = computed<NasPillTab[]>(() => [
    { id: 'all',      label: 'All' },
    { id: 'unread',   label: 'Unread' },
    { id: 'sent',     label: 'Sent',     count: this.total() },
    { id: 'resolved', label: 'Resolved' },
  ]);

  composeForm = this.fb.group({
    title:          ['', Validators.required],
    recipient_ids:  [[] as number[]],
    all_learners:   [false],
    all_instructors:[false],
    message:        ['', Validators.required],
  });

  filteredUsers = computed(() => {
    const term = this.recipientSearch().toLowerCase();
    const filter = this.recipientFilter();
    return this.userOptions().filter(u => {
      if (filter === 'learners'    && u.is_instructor) return false;
      if (filter === 'instructors' && !u.is_instructor) return false;
      return !term || u.name.toLowerCase().includes(term);
    });
  });

  learners    = computed(() => this.filteredUsers().filter(u => !u.is_instructor));
  instructors = computed(() => this.filteredUsers().filter(u =>  u.is_instructor));

  ngOnInit(): void {
    this.load();
    this.loadUsers();
  }

  /* ── Data ─────────────────────────────────────────────────────────── */
  load(): void {
    this.loading.set(true);
    this.api.getPaginated<MessageItem>(API.MESSAGES, { page: this.page, per_page: this.perPage }).subscribe({
      next:  res => {
        this.items.set(res.result.data.map(m => this.mapMessage(m)));
        this.total.set(res.result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadUsers(): void {
    this.api.getPaginated<UserOption>(API.USERS, { per_page: 500 }).subscribe({
      next: r => this.userOptions.set(r.result.data ?? []),
    });
  }

  private mapMessage(m: MessageItem & { total_recipients?: number; read_count?: number }): MessageItem {
    const count = m.recipients_count ?? m.total_recipients ?? 0;
    return {
      ...m,
      recipients_count: count,
      read_count: m.read_count ?? 0,
      preview: m.preview ?? (m.body ? m.body.slice(0, 100) : ''),
      recipients_text: m.recipients_text ?? (count ? `${count} recipients` : 'Recipients'),
    };
  }

  /* ── Tabs ─────────────────────────────────────────────────────────── */
  setTab(t: string): void {
    this.activeTab.set(t as InboxTab);
  }

  /* ── Compose ──────────────────────────────────────────────────────── */
  openCompose(): void {
    this.composeForm.reset({
      title: '', recipient_ids: [], all_learners: false, all_instructors: false, message: '',
    });
    this.recipientSearch.set('');
    this.recipientFilter.set('all');
    this.showCompose.set(true);
  }

  toggleRecipient(id: number, checked: boolean): void {
    const ids = new Set(this.composeForm.value.recipient_ids ?? []);
    if (checked) ids.add(id); else ids.delete(id);
    this.composeForm.patchValue({ recipient_ids: Array.from(ids) });
  }

  isRecipientSelected(id: number): boolean {
    return (this.composeForm.value.recipient_ids ?? []).includes(id);
  }

  toggleAllLearners(checked: boolean): void {
    const learnerIds = this.learners().map(l => l.id);
    const current   = new Set(this.composeForm.value.recipient_ids ?? []);
    if (checked) learnerIds.forEach(id => current.add(id));
    else         learnerIds.forEach(id => current.delete(id));
    this.composeForm.patchValue({ recipient_ids: Array.from(current), all_learners: checked });
  }

  send(): void {
    if (this.composeForm.invalid) { this.composeForm.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.composeForm.getRawValue();
    this.api.post(API.MESSAGES, {
      subject: v.title!,
      body:    v.message!,
      recipient_ids: v.recipient_ids ?? [],
    }).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', detail: 'Message sent' });
        this.showCompose.set(false);
        this.saving.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  /* ── Welcome card (sample) ────────────────────────────────────────── */
  viewWelcome(): void { this.showWelcome.set(true); }
}
