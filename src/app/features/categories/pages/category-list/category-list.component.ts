import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { NasStatusBadgeComponent } from '../../../../shared/nas/nas-status-badge.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface Category {
  id: number;
  name: string;
  logo?: string | null;
  active?: boolean;
  /** Only populated when the list endpoint includes course counts. */
  courses_count?: number;
  created_at?: string;
}

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, ConfirmDialogModule, SkeletonModule, NasPageHeaderComponent, NasStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss',
})
export class CategoryListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  constructor() { withLocaleReload(() => this.load()); }

  items   = signal<Category[]>([]);
  total   = signal(0);
  loading = signal(true);

  readonly perPage   = 20;
  page               = 1;
  search             = '';
  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min       = Math.min;

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = { page: this.page, per_page: this.perPage };
    if (this.search) params['search'] = this.search;
    this.api.getPaginated<Category>(API.CATEGORIES, params).subscribe({
      next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  onPage(p: number): void { this.page = p; this.load(); }

  onSearch(term: string): void { this.search$.next(term); }

  confirmDelete(item: Category): void {
    this.confirmService.confirm({
      message: `Delete "${item.name}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.delete(`${API.CATEGORIES}/${item.id}`).subscribe({
          next: () => { this.messageService.add({ severity: 'success', detail: 'Category deleted.' }); this.load(); },
        });
      },
    });
  }
}
