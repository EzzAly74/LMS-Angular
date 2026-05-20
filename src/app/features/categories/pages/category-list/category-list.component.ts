import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

interface Category {
  id: number;
  name: string;
  logo: string | null;
  active: boolean;
  courses_count: number;
  created_at: string;
}

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, TableModule, ButtonModule, InputTextModule, TagModule, AvatarModule, ConfirmDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-list.component.html',
})
export class CategoryListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  items   = signal<Category[]>([]);
  total   = signal(0);
  loading = signal(true);
  perPage = 20;
  page    = 1;
  search  = '';

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<Category>(API.CATEGORIES, { page: this.page, per_page: this.perPage, search: this.search || undefined })
      .subscribe({
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

  confirmDelete(item: Category): void {
    this.confirmService.confirm({
      message: `Delete "${item.name}"?`,
      accept: () => {
        this.api.delete(`${API.CATEGORIES}/${item.id}`).subscribe({
          next: () => { this.messageService.add({ severity: 'success', detail: 'Deleted.' }); this.load(); },
        });
      },
    });
  }
}
