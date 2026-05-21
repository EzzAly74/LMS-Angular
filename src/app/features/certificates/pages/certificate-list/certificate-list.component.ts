import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { NasStatusBadgeComponent } from '../../../../shared/nas/nas-status-badge.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface Certificate {
  id: number;
  /** Backend always sends these but mark optional for defensive rendering. */
  user?: { id?: number; name?: string; machine_code?: string | null };
  course?: { id?: number; title?: string; title_for_certificate?: string };
  type?: 'exam' | 'evaluation' | string;
  user_degree?: number | null;
  total_degree?: number | null;
  created_at?: string;
}

@Component({
  selector: 'app-certificate-list',
  standalone: true,
  imports: [CommonModule, SkeletonModule, NasPageHeaderComponent, NasStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './certificate-list.component.html',
  styleUrl: './certificate-list.component.scss',
})
export class CertificateListComponent implements OnInit {
  private api = inject(ApiService);

  constructor() { withLocaleReload(() => this.load()); }

  items   = signal<Certificate[]>([]);
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
    this.api.getPaginated<Certificate>(API.CERTIFICATES, {
      page: this.page, per_page: this.perPage, search: this.search || undefined,
    }).subscribe({
      next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  onPage(p: number): void { this.page = p; this.load(); }
  onSearch(term: string): void { this.search$.next(term); }
}
