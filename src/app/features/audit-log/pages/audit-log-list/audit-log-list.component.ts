import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { CalendarModule } from 'primeng/calendar';
import { FormsModule } from '@angular/forms';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

interface AuditEntry {
  id: number;
  user_name: string;
  user_type?: string;
  action: string;
  model_type?: string;
  model_id?: number;
  description: string;
  ip_address?: string;
  created_at: string;
}

@Component({
  selector: 'app-audit-log-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, SkeletonModule, CalendarModule, FormsModule, NasPageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log-list.component.html',
  styleUrl: './audit-log-list.component.scss',
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

  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min = Math.min;

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

  onPage(p: number): void {
    this.page = p;
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
