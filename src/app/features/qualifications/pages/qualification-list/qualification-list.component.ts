import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

interface Qualification {
  id: number;
  name: string;
  name_en?: string;
  name_ar?: string;
  courses_count?: number;
  created_at?: string;
}

interface QualificationForm {
  name_en: string;
  name_ar: string;
}

@Component({
  selector: 'app-qualification-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, SkeletonModule, ConfirmDialogModule, FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qualification-list.component.html',
})
export class QualificationListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  items   = signal<Qualification[]>([]);
  total   = signal(0);
  loading = signal(true);
  saving  = signal(false);

  perPage       = 15;
  page          = 1;
  search        = '';
  dialogVisible = false;
  editingId: number | null = null;
  form: QualificationForm = { name_en: '', name_ar: '' };

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

  onPage(event: TableLazyLoadEvent): void {
    this.page = Math.floor((event.first ?? 0) / (event.rows ?? this.perPage)) + 1;
    this.load();
  }

  onSearch(e: Event): void {
    this.search$.next((e.target as HTMLInputElement).value);
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { name_en: '', name_ar: '' };
    this.dialogVisible = true;
  }

  openEdit(item: Qualification): void {
    this.editingId = item.id;
    this.form = { name_en: item.name_en ?? item.name, name_ar: item.name_ar ?? item.name };
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
        this.messageService.add({ severity: 'success', detail: this.editingId ? 'Updated.' : 'Created.' });
      },
      error: () => this.saving.set(false),
    });
  }

  confirmDelete(item: Qualification): void {
    this.confirmService.confirm({
      message: `Delete "${item.name_en ?? item.name}"?`,
      accept: () => {
        this.api.delete(`${API.QUALIFICATIONS}/${item.id}`).subscribe({
          next: () => { this.messageService.add({ severity: 'success', detail: 'Deleted.' }); this.load(); },
        });
      },
    });
  }
}
