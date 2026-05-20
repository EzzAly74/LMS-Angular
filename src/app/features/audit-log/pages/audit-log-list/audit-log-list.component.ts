import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { CalendarModule } from 'primeng/calendar';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

interface AuditEntry {
  id: number;
  user_name: string;
  user_email?: string;
  action: string;
  description: string;
  ip_address?: string;
  created_at: string;
}

@Component({
  selector: 'app-audit-log-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, TableModule, ButtonModule, SkeletonModule, CalendarModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log-list.component.html',
})
export class AuditLogListComponent implements OnInit {
  private api = inject(ApiService);

  items   = signal<AuditEntry[]>([]);
  total   = signal(0);
  loading = signal(true);

  perPage  = 20;
  page     = 1;
  dateFrom: Date | null = null;
  dateTo:   Date | null = null;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const params: Record<string, string | number | boolean | null | undefined> = {
      page: this.page,
      per_page: this.perPage,
    };
    if (this.dateFrom) params['date_from'] = this.formatDate(this.dateFrom);
    if (this.dateTo)   params['date_to']   = this.formatDate(this.dateTo);

    this.api.getPaginated<AuditEntry>(API.AUDIT_LOG, params).subscribe({
      next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  onPage(event: TableLazyLoadEvent): void {
    this.page = Math.floor((event.first ?? 0) / (event.rows ?? this.perPage)) + 1;
    this.load();
  }

  onDateChange(): void {
    this.page = 1;
    this.load();
  }

  clearDates(): void {
    this.dateFrom = null;
    this.dateTo   = null;
    this.page     = 1;
    this.load();
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
