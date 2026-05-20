import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

interface LmsResource {
  id: number;
  title: string;
  type: 'article' | 'link' | 'file';
  qualification?: string;
  created_at: string;
}

@Component({
  selector: 'app-resource-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink, TableModule, ButtonModule, TagModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-list.component.html',
})
export class ResourceListComponent implements OnInit {
  private api = inject(ApiService);

  items   = signal<LmsResource[]>([]);
  total   = signal(0);
  loading = signal(true);
  perPage = 20;
  page    = 1;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<LmsResource>(API.LMS_RESOURCES, { page: this.page, per_page: this.perPage })
      .subscribe({
        next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  onPage(event: TableLazyLoadEvent): void {
    this.page = Math.floor((event.first ?? 0) / (event.rows ?? this.perPage)) + 1;
    this.load();
  }

  typeIcon(type: string): string {
    return type === 'link' ? 'pi pi-link' : type === 'file' ? 'pi pi-paperclip' : 'pi pi-file';
  }
}
