import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateModule } from '@ngx-translate/core';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header/nas-page-header.component';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { BlogsApiService } from '../../services/blogs-api.service';
import { BlogListItem } from '../../models/blog.types';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SkeletonModule,
    TranslateModule,
    NasPageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './blog-list.component.html',
  styleUrl: './blog-list.component.scss',
})
export class BlogListComponent implements OnInit {
  private readonly api = inject(BlogsApiService);
  private readonly router = inject(Router);

  items = signal<BlogListItem[]>([]);
  total = signal(0);
  loading = signal(true);
  openMenuId = signal<number | null>(null);

  /** The blog pending deletion — drives the confirm modal. */
  pendingDelete = signal<BlogListItem | null>(null);
  deleting = signal(false);

  page = 1;
  readonly perPage = 15;
  readonly skeletons = [1, 2, 3, 4, 5, 6, 7];
  readonly min = Math.min;

  constructor() {
    withLocaleReload(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list({ page: this.page, per_page: this.perPage }).subscribe({
      next: (res) => {
        this.items.set(res.result.data);
        this.total.set(res.result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPage(p: number): void {
    this.page = p;
    this.load();
  }

  toggleMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  edit(id: number): void {
    this.closeMenu();
    this.router.navigate(['/admin/blogs', id, 'edit']);
  }

  askDelete(item: BlogListItem, event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenu();
    this.pendingDelete.set(item);
  }

  cancelDelete(): void {
    if (this.deleting()) return;
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item) return;
    this.deleting.set(true);
    this.api.remove(item.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        // Step back a page if we just removed the last row on it.
        if (this.items().length === 1 && this.page > 1) this.page--;
        this.load();
      },
      error: () => this.deleting.set(false),
    });
  }
}
