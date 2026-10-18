import { NasConfirmService } from '../../../../shared/nas/nas-confirm-modal/nas-confirm.service';
import { NasListStateComponent } from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header/nas-page-header.component';
import { NasStatusBadgeComponent } from '../../../../shared/nas/nas-status-badge/nas-status-badge.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { ToastService } from '../../../../core/services/toast.service';

import { LocalDatePipe } from '../../../../shared/pipes/local-date.pipe';
interface Article {
  id: number;
  title: string;
  type: string;
  slug: string;
  date_publish: string;
  is_home: boolean;
  active: boolean;
  created_at: string;
}

@Component({
  selector: 'app-article-list',
  standalone: true,
  imports: [NasListStateComponent, LocalDatePipe, CommonModule, SkeletonModule, TranslateModule, NasPageHeaderComponent, NasStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-list.component.html',
  styleUrl: './article-list.component.scss',
})
export class ArticleListComponent implements OnInit {
  private api            = inject(ApiService);
  private readonly confirmDialog = inject(NasConfirmService);
  private messageService = inject(ToastService);
  private t              = inject(TranslateService);

  constructor() { withLocaleReload(() => this.load()); }

  items   = signal<Article[]>([]);
  total   = signal(0);
  loading = signal(true);

  readonly perPage  = 20;
  page              = 1;
  search            = '';
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
    this.api.getPaginated<Article>(API.ARTICLES, {
      page: this.page, per_page: this.perPage, search: this.search || undefined,
    }).subscribe({
      next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  onPage(p: number): void { this.page = p; this.load(); }

  onSearch(term: string): void { this.search$.next(term); }

  confirmDelete(item: Article): void {
    void this.confirmDialog.ask({
      title: this.t.instant('articles.confirm_delete'),
      message: this.t.instant('confirm.delete_message_title', { title: item.title }),
    }).then(confirmed => {
      if (!confirmed) return;
      this.api.delete(`${API.ARTICLES}/${item.id}`).subscribe({
        next: () => {
          this.messageService.success('articles.deleted');
          this.load();
        },
      });
    });
  }
}
