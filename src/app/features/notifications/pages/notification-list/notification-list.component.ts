import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { pickLocalized, type MaybeLocalized } from '../../../../core/utils/localized';
import { LocaleService } from '../../../../core/services/locale.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface Notification {
  id: number;
  title: MaybeLocalized;
  body: MaybeLocalized;
  for_public: boolean;
  created_at: string;
}

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DialogModule, SkeletonModule,
    ConfirmDialogModule, TranslateModule, NasPageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-list.component.html',
  styleUrl: './notification-list.component.scss',
})
export class NotificationListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private localeService  = inject(LocaleService);
  private t              = inject(TranslateService);

  constructor() { withLocaleReload(() => this.load()); }

  /** Defensive: handle Spatie translation objects if they leak into responses. */
  display(value: MaybeLocalized): string {
    const locale = this.localeService.locale() === 'ar' ? 'ar' : 'en';
    return pickLocalized(value, locale, '—') || '—';
  }

  items   = signal<Notification[]>([]);
  total   = signal(0);
  loading = signal(true);
  saving  = signal(false);

  readonly perPage  = 20;
  page              = 1;
  search            = '';
  dialogVisible     = false;
  form = { title: '', body: '', for_public: false };

  readonly skeletons = [1, 2, 3, 4, 5];

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<Notification>(API.NOTIFICATIONS, {
      page: this.page, per_page: this.perPage, search: this.search || undefined,
    }).subscribe({
      next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  onSearch(term: string): void { this.search$.next(term); }

  openCreate(): void {
    this.form = { title: '', body: '', for_public: false };
    this.dialogVisible = true;
  }

  closeDialog(): void {
    this.dialogVisible = false;
    this.form = { title: '', body: '', for_public: false };
  }

  save(): void {
    const title = this.form.title.trim();
    const body  = this.form.body.trim();
    if (!title || !body) return;
    this.saving.set(true);
    /**
     * Laravel `Notification` model uses spatie/laravel-translatable on
     * `title` and `body`, so we must send the value for every supported
     * locale. We use the same input for both languages — admins can edit
     * the translation later if needed.
     */
    const payload = {
      title:      { en: title, ar: title },
      body:       { en: body,  ar: body  },
      for_public: this.form.for_public,
    };
    this.api.post(API.NOTIFICATIONS, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.load();
        this.messageService.add({
          severity: 'success',
          summary:  this.t.instant('common.saved'),
          detail:   this.t.instant('notifications.sent'),
        });
      },
      error: () => this.saving.set(false),
    });
  }

  confirmDelete(item: Notification): void {
    this.confirmService.confirm({
      message: `${this.t.instant('confirm.delete_message')} (${this.display(item.title)})`,
      header:  this.t.instant('notifications.confirm_delete'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.delete(`${API.NOTIFICATIONS}/${item.id}`).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary:  this.t.instant('common.deleted'),
              detail:   this.t.instant('notifications.deleted'),
            });
            this.load();
          },
        });
      },
    });
  }
}
