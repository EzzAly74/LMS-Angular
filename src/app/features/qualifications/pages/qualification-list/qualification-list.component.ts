import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header/nas-page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { pickLocalized } from '../../../../core/utils/localized';
import { LocaleService } from '../../../../core/services/locale.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface Qualification {
  id: number;
  name: string;
  name_en?: string;
  name_ar?: string;
  courses_count?: number;
  enrolled_count?: number;
  created_at?: string;
}

@Component({
  selector: 'app-qualification-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DialogModule, SkeletonModule,
    ConfirmDialogModule, TranslateModule, NasPageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qualification-list.component.html',
  styleUrl: './qualification-list.component.scss',
})
export class QualificationListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private localeService  = inject(LocaleService);
  private t              = inject(TranslateService);

  constructor() { withLocaleReload(() => this.load()); }

  qualName(item: Qualification): string {
    const locale = this.localeService.locale() === 'ar' ? 'ar' : 'en';
    return (
      pickLocalized(item.name, locale, '') ||
      (locale === 'ar' ? (item.name_ar ?? '') : (item.name_en ?? '')) ||
      (item.name_en ?? item.name_ar ?? '') ||
      '—'
    );
  }

  items     = signal<Qualification[]>([]);
  total     = signal(0);
  loading   = signal(true);
  saving    = signal(false);
  activeRow = signal<Qualification | null>(null);

  readonly perPage    = 15;
  page                = 1;
  search              = '';
  dialogVisible       = false;
  editingId: number | null = null;
  form = { name_en: '', name_ar: '' };

  readonly skeletons = [1, 2, 3, 4, 5];

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<Qualification>(API.QUALIFICATIONS, {
      page: this.page, per_page: this.perPage, search: this.search || undefined,
    }).subscribe({
      next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  onSearch(term: string): void { this.search$.next(term); }

  openCreate(): void {
    this.editingId = null;
    this.form = { name_en: '', name_ar: '' };
    this.activeRow.set(null);
    this.dialogVisible = true;
  }

  openEdit(item: Qualification): void {
    this.editingId = item.id;
    this.form = { name_en: item.name_en ?? item.name, name_ar: item.name_ar ?? '' };
    this.activeRow.set(null);
    this.dialogVisible = true;
  }

  closeDialog(): void {
    this.dialogVisible = false;
    this.editingId = null;
    this.form = { name_en: '', name_ar: '' };
  }

  save(): void {
    if (!this.form.name_en.trim()) return;
    this.saving.set(true);
    const payload = { name: { en: this.form.name_en, ar: this.form.name_ar } };
    const req = this.editingId
      ? this.api.put(`${API.QUALIFICATIONS}/${this.editingId}`, payload)
      : this.api.post(API.QUALIFICATIONS, payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.load();
        this.messageService.add({
          severity: 'success',
          summary:  this.t.instant('common.saved'),
          detail:   this.t.instant('qualifications.saved'),
        });
      },
      error: () => this.saving.set(false),
    });
  }

  toggleRowMenu(item: Qualification, event: Event): void {
    event.stopPropagation();
    this.activeRow.set(this.activeRow()?.id === item.id ? null : item);
  }

  closeAllMenus(): void { this.activeRow.set(null); }

  confirmDelete(item: Qualification): void {
    this.activeRow.set(null);
    this.confirmService.confirm({
      message: `${this.t.instant('confirm.delete_message')} (${item.name_en ?? item.name})`,
      header:  this.t.instant('qualifications.confirm_delete'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.delete(`${API.QUALIFICATIONS}/${item.id}`).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary:  this.t.instant('common.deleted'),
              detail:   this.t.instant('qualifications.deleted'),
            });
            this.load();
          },
        });
      },
    });
  }
}
