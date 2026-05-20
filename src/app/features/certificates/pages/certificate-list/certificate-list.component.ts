import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

interface Certificate {
  id: number;
  user: { name: string; machine_code: string };
  course: { id: number; title: string };
  type: string;
  created_at: string;
}

@Component({
  selector: 'app-certificate-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, TableModule, ButtonModule, InputTextModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './certificate-list.component.html',
})
export class CertificateListComponent implements OnInit {
  private api = inject(ApiService);

  items   = signal<Certificate[]>([]);
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
    this.api.getPaginated<Certificate>(API.CERTIFICATES, { page: this.page, per_page: this.perPage, search: this.search || undefined })
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
}
