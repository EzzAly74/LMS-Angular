import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { NasStatusBadgeComponent } from '../../../../shared/nas/nas-status-badge.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface LmsResource {
  id: number;
  title: string;
  type: 'article' | 'link' | 'file';
  qualification?: { id: number; name: string } | null;
  created_at: string;
}

@Component({
  selector: 'app-resource-list',
  standalone: true,
  imports: [CommonModule, RouterLink, SkeletonModule, NasPageHeaderComponent, NasStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-list.component.html',
  styleUrl: './resource-list.component.scss',
})
export class ResourceListComponent implements OnInit {
  private api = inject(ApiService);

  constructor() { withLocaleReload(() => this.load()); }

  items   = signal<LmsResource[]>([]);
  total   = signal(0);
  loading = signal(true);

  readonly perPage   = 20;
  page               = 1;
  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min       = Math.min;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<LmsResource>(API.LMS_RESOURCES, { page: this.page, per_page: this.perPage })
      .subscribe({
        next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  onPage(p: number): void { this.page = p; this.load(); }

  typeIcon(type: string): string {
    return type === 'link' ? 'pi pi-link' : type === 'file' ? 'pi pi-paperclip' : 'pi pi-file-edit';
  }
}
