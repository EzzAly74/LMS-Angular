import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header/nas-page-header.component';
import { NasStatusBadgeComponent } from '../../../../shared/nas/nas-status-badge/nas-status-badge.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface Attendance {
  id: number;
  user_machine_code: string;
  user_department: string;
  course_name: string;
  course_category_name: string;
  attendance_hours: number;
  is_manual: boolean;
  created_at: string;
}

@Component({
  selector: 'app-attendance-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, SkeletonModule, NasPageHeaderComponent, NasStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance-list.component.html',
  styleUrl: './attendance-list.component.scss',
})
export class AttendanceListComponent implements OnInit {
  private api = inject(ApiService);

  constructor() { withLocaleReload(() => this.load()); }

  items   = signal<Attendance[]>([]);
  total   = signal(0);
  loading = signal(true);
  perPage = 20;
  page    = 1;
  search  = '';

  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min = Math.min;

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<Attendance>(API.ATTENDANCE, { page: this.page, per_page: this.perPage, search: this.search || undefined })
      .subscribe({
        next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  onPage(p: number): void {
    this.page = p;
    this.load();
  }

  onSearch(e: Event): void {
    this.search$.next((e.target as HTMLInputElement).value);
  }
}
