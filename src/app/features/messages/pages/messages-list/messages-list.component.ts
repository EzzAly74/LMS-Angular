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
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { forkJoin } from 'rxjs';
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

interface MessageItem {
  id: number;
  subject: string;
  body: string;
  preview?: string;
  recipients_count: number;
  read_count: number;
  recipients_text?: string;
  recipient_tags?: string[];
  has_learner_recipients?: boolean;
  has_instructor_recipients?: boolean;
  created_at: string;
  is_read?: boolean;
  resolved?: boolean;
}

interface UserOption {
  id: number;
  name: string;
  is_instructor?: boolean;
}

type InboxTab = 'all' | 'unread' | 'sent' | 'received';

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
    // Reload the messages list AND the compose recipient picker
    // (user names render localized) on every language switch.
    withLocaleReload(() => {
      this.page = 1;
      this.load();
      this.loadUsers();
    });
  }

  items = signal<MessageItem[]>([]);
  total = signal(0);
  loading = signal(true);
  activeTab = signal<InboxTab>('sent');
  userOptions = signal<UserOption[]>([]);

  showCompose      = signal(false);
  showWelcome      = signal(false);
  selectedMessage  = signal<MessageItem | null>(null);
  loadingDetail    = signal(false);
  markingAllRead   = signal(false);
  saving           = signal(false);

  recipientSearch = signal('');
  recipientFilter = signal<'all' | 'learners' | 'instructors'>('all');

  page = 1;
  perPage = 50;
  readonly skeletonRows = [0, 1, 2, 3, 4];

  /**
   * Inbox tab pills — driven by the backend `inbox_tab` enum so labels
   * are localized and the option set stays in sync with the filter
   * clauses on the server. The `sent` tab additionally surfaces the
   * total count.
   */
  tabs = computed<NasPillTab[]>(() =>
    this.enums
      .options('inbox_tab')()
      .map((o) => ({ id: o.code, label: o.value })),
  );

  readonly TITLE_MAX = 191;
  readonly MESSAGE_MAX = 255;

  private atLeastOneRecipient = (
    ctrl: AbstractControl,
  ): ValidationErrors | null => {
    const ids: number[] = ctrl.value ?? [];
    return ids.length > 0 ? null : { noRecipients: true };
  };

  composeForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(this.TITLE_MAX)]],
    recipient_ids: [[] as number[], [this.atLeastOneRecipient]],
    all_learners: [false],
    all_instructors: [false],
    message: [
      '',
      [Validators.required, Validators.maxLength(this.MESSAGE_MAX)],
    ],
  });

  get titleCtrl() {
    return this.composeForm.controls.title;
  }
  get messageCtrl() {
    return this.composeForm.controls.message;
  }
  get recipientsCtrl() {
    return this.composeForm.controls.recipient_ids;
  }

  filteredUsers = computed(() => {
    const term = this.recipientSearch().toLowerCase();
    const filter = this.recipientFilter();
    return this.userOptions().filter((u) => {
      if (filter === 'learners' && u.is_instructor) return false;
      if (filter === 'instructors' && !u.is_instructor) return false;
      return !term || u.name.toLowerCase().includes(term);
    });
  });

  learners = computed(() =>
    this.filteredUsers().filter((u) => !u.is_instructor),
  );
  instructors = computed(() =>
    this.filteredUsers().filter((u) => u.is_instructor),
  );

  ngOnInit(): void {
    this.load();
    this.loadUsers();
  }

  /* ── Data ─────────────────────────────────────────────────────────── */
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
          this.items.set(res.result.data.map((m) => this.mapMessage(m)));
          this.total.set(res.result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  loadUsers(): void {
    forkJoin({
      learners: this.api.getPaginated<UserOption>(API.USERS, {
        per_page: 500,
        role: 'learner',
      }),
      instructors: this.api.getPaginated<UserOption>(API.INSTRUCTORS, {
        per_page: 500,
      }),
    }).subscribe({
      next: ({ learners, instructors }) => {
        const learnerList = (learners.result.data ?? []).map((u) => ({
          ...u,
          is_instructor: false,
        }));
        const instructorList = (instructors.result.data ?? []).map((u) => ({
          ...u,
          is_instructor: true,
        }));
        this.userOptions.set([...learnerList, ...instructorList]);
      },
    });
  }

  private mapMessage(
    m: MessageItem & { total_recipients?: number; read_count?: number },
  ): MessageItem {
    const count = m.recipients_count ?? m.total_recipients ?? 0;

    const recipientsText =
      m.recipients_text ?? (count ? `${count} recipients` : 'Recipients');

    // Use backend-provided flags so the pills are always accurate —
    // the list endpoint never loads the recipients relation itself.
    const tags: string[] = [];
    if (m.has_learner_recipients)    tags.push('Learners');
    if (m.has_instructor_recipients) tags.push('Instructors');
    if (tags.length === 0 && count > 0) tags.push('Learners');

    return {
      ...m,
      recipients_count: count,
      read_count:       m.read_count ?? 0,
      preview:          m.preview ?? (m.body ? m.body.slice(0, 200) : ''),
      recipients_text:  recipientsText,
      recipient_tags:   tags,
    };
  }

  openMessage(m: MessageItem): void {
    this.selectedMessage.set(m);
    this.showWelcome.set(true);
    this.refreshDetail(m.id);
  }

  refreshDetail(id: number): void {
    this.loadingDetail.set(true);
    this.api.get<MessageItem>(`${API.MESSAGES}/${id}`).subscribe({
      next: res => {
        if (res.result) {
          this.selectedMessage.set(this.mapMessage(res.result as MessageItem & { total_recipients?: number }));
        }
        this.loadingDetail.set(false);
      },
      error: () => this.loadingDetail.set(false),
    });
  }

  markAllRead(id: number): void {
    this.markingAllRead.set(true);
    this.api.patch(API.messageMarkAllRead(id)).subscribe({
      next: () => {
        this.markingAllRead.set(false);
        this.refreshDetail(id);
      },
      error: () => this.markingAllRead.set(false),
    });
  }

  /* ── Tabs ─────────────────────────────────────────────────────────── */
  setTab(t: string): void {
    this.page = 1;
    this.activeTab.set(t as InboxTab);
    this.load();
  }

  /* ── Compose ──────────────────────────────────────────────────────── */
  openCompose(): void {
    this.composeForm.reset({
      title: '',
      recipient_ids: [],
      all_learners: false,
      all_instructors: false,
      message: '',
    });
    this.recipientSearch.set('');
    this.recipientFilter.set('all');
    this.showCompose.set(true);
  }

  toggleRecipient(id: number, checked: boolean): void {
    const ids = new Set(this.composeForm.value.recipient_ids ?? []);
    if (checked) ids.add(id);
    else ids.delete(id);
    this.composeForm.patchValue({ recipient_ids: Array.from(ids) });
  }

  isRecipientSelected(id: number): boolean {
    return (this.composeForm.value.recipient_ids ?? []).includes(id);
  }

  toggleAllLearners(checked: boolean): void {
    const learnerIds = this.learners().map((l) => l.id);
    const current = new Set(this.composeForm.value.recipient_ids ?? []);
    if (checked) learnerIds.forEach((id) => current.add(id));
    else learnerIds.forEach((id) => current.delete(id));
    this.composeForm.patchValue({
      recipient_ids: Array.from(current),
      all_learners: checked,
    });
  }

  send(): void {
    this.composeForm.markAllAsTouched();
    if (this.composeForm.invalid) return;
    this.saving.set(true);
    const v = this.composeForm.getRawValue();
    const opts = this.userOptions();
    const selected = v.recipient_ids ?? [];

    const recipient_ids = selected.filter(
      (id) => !opts.find((u) => u.id === id && u.is_instructor),
    );
    const instructor_ids = selected.filter((id) =>
      opts.find((u) => u.id === id && u.is_instructor),
    );

    this.api
      .post(API.MESSAGES, {
        subject: v.title!,
        body: v.message!,
        recipient_ids,
        instructor_ids,
      })
      .subscribe({
        next: () => {
          this.toast.add({
            severity: 'success',
            detail: this.t.instant('messages_list_toasts.sent'),
          });
          this.showCompose.set(false);
          this.saving.set(false);
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  closeMessageDetail(): void {
    this.showWelcome.set(false);
    this.selectedMessage.set(null);
  }
}
