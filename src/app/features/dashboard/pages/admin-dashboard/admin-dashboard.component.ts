import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { DashboardApiService, DashboardData, DashboardNotification } from '../../services/dashboard-api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import {
  NasStatCardComponent,
  NasStatusBadgeComponent,
  NasProgressComponent,
  NasPillTabsComponent,
  NasPillTab,
} from '../../../../shared/nas';

interface KpiStats {
  active_learners: number;
  active_learners_online: number;
  active_learners_offline: number;
  active_courses: number;
  awaiting_publish: number;
  org_compliance_percent?: number;
  courses: number;
  users: number;
  ratings: number;
  unanswered_questions: number;
  user_assignments: number;
  instructors?: number;
}

interface TopCourse {
  id: number;
  title: string;
  instructor?: string;
  users_count: number;
  completion_percent?: number;
  status?: string;
}

type TrendRange = 'week' | 'month' | 'quarter' | 'year';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    ChartModule,
    ButtonModule,
    SkeletonModule,
    DatePipe,
    NasStatCardComponent,
    NasStatusBadgeComponent,
    NasProgressComponent,
    NasPillTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private dashboardApi = inject(DashboardApiService);
  private locale = inject(LocaleService);

  loading = signal(true);
  data = signal<DashboardData | null>(null);
  today = new Date();

  trendRange = signal<TrendRange>('month');
  rangeTabs: NasPillTab[] = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'quarter', label: 'Quarter' },
    { id: 'year', label: 'Year' },
  ];

  greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12
      ? 'dashboard.good_morning'
      : h < 17
        ? 'dashboard.good_afternoon'
        : 'dashboard.good_evening';
  });

  chartData = computed(() => {
    const trend = this.data()?.enrollment_trend;
    if (!trend?.length) return null;
    return {
      labels: trend.map((t) => t.date),
      datasets: [
        {
          label: 'Enrollments',
          data: trend.map((t) => t.enrollments),
          borderColor: '#26787B',
          backgroundColor: 'rgba(38, 120, 123, 0.10)',
          tension: 0.4,
          fill: true,
          pointRadius: 0,
        },
        {
          label: 'Completions',
          data: trend.map((t) => t.completions),
          borderColor: '#0FB86A',
          backgroundColor: 'rgba(15, 184, 106, 0.08)',
          tension: 0.4,
          fill: true,
          pointRadius: 0,
        },
      ],
    };
  });

  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'start',
        labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 } },
      },
      tooltip: { backgroundColor: '#0C2427', padding: 10 },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#8C8C8C', font: { size: 11 } },
      },
      y: {
        grid: { color: '#F5F5F5', drawBorder: false },
        ticks: { color: '#8C8C8C', font: { size: 11 } },
      },
    },
  } as const;

  statusTone(
    status: string | undefined,
  ): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
    switch ((status ?? '').toLowerCase()) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'upcoming':
      case 'up_coming':
      case 'up coming':
        return 'info';
      case 'inactive':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.dashboardApi.getSummary().subscribe({
      next: (res) => {
        this.data.set(res.result);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
