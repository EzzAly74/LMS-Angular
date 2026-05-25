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
import {
  DashboardApiService,
  DashboardData,
  DashboardNotification,
  DashboardTrendRange,
} from '../../services/dashboard-api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { pickLocalized } from '../../../../core/utils/localized';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import {
  NasStatCardComponent,
  NasStatusBadgeComponent,
  NasProgressComponent,
  NasPillTabsComponent,
  NasPillTab,
  NasIconComponent,
} from '../../../../shared/nas';
import { NotificationsDrawerService } from '../../../../shared/nas/notifications-drawer/notifications-drawer.service';

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
  title: string | { en?: string; ar?: string } | null;
  instructor?: string | { id?: number; name?: string | { en?: string; ar?: string } } | null;
  /** May be missing if the backend hasn't computed the relation yet. */
  users_count?: number;
  completion_percent?: number;
  status?: string;
}

type TrendRange = DashboardTrendRange;

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
    NasIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private dashboardApi = inject(DashboardApiService);
  private locale       = inject(LocaleService);
  private enums        = inject(EnumsService);
  notifsDrawer         = inject(NotificationsDrawerService);

  loading      = signal(true);
  data         = signal<DashboardData | null>(null);
  today        = new Date();

  trendRange = signal<TrendRange>('month');

  /**
   * Trend chart range tabs — sourced from the backend `dashboard_range`
   * enum. The tab `id` carries the string code because the API expects
   * `?range=week|month|quarter|year` as a string filter, not a numeric id.
   */
  rangeTabs = computed<NasPillTab[]>(() =>
    this.enums.options('dashboard_range')().map(o => ({
      id: o.code,
      label: o.value,
    })),
  );

  constructor() {
    withLocaleReload(() => this.load());
  }

  /**
   * Range tabs are fully server-driven — switching the active tab fires
   * a fresh `/dashboard?range=…` request so the bucket grid (daily /
   * weekly / monthly) always comes back pre-built. No client fabrication.
   */
  onRangeChange(range: TrendRange): void {
    if (this.trendRange() === range) return;
    this.trendRange.set(range);
    this.fetch(range);
  }

  greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12
      ? 'dashboard.good_morning'
      : h < 17
        ? 'dashboard.good_afternoon'
        : 'dashboard.good_evening';
  });

  /** Backend-driven trend buckets — never fabricated. */
  private readonly trendSeries = computed(() => {
    const backend = this.data()?.enrollment_trend ?? [];
    return {
      labels:      backend.map(t => t.label),
      enrollments: backend.map(t => t.enrollments ?? 0),
      completions: backend.map(t => t.completions ?? 0),
    };
  });

  /** True when every bucket is zero — render the empty state instead. */
  readonly trendIsEmpty = computed(() => {
    const s = this.trendSeries();
    if (!s.labels.length) return true;
    return s.enrollments.every(v => !v) && s.completions.every(v => !v);
  });

  chartData = computed(() => {
    const series = this.trendSeries();
    return {
      labels: series.labels,
      datasets: [
        {
          label: 'Enrollments',
          data: series.enrollments,
          borderColor: '#26787B',
          backgroundColor: 'rgba(38, 120, 123, 0.12)',
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'Completions',
          data: series.completions,
          borderColor: '#0FB86A',
          backgroundColor: 'rgba(15, 184, 106, 0.10)',
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  });

  /** Header subtitle — total enrollments in the current series. */
  readonly trendTotalEnrollments = computed(() =>
    this.trendSeries().enrollments.reduce((sum, v) => sum + v, 0),
  );

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
        ticks: {
          color: '#8C8C8C',
          font: { size: 11 },
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 12,
        },
      },
      y: {
        grid: { color: '#F5F5F5', drawBorder: false },
        ticks: {
          color: '#8C8C8C',
          font: { size: 11 },
          precision: 0,
          beginAtZero: true,
        },
      },
    },
  } as const;

  private get uiLocale(): 'en' | 'ar' {
    return this.locale.locale() === 'ar' ? 'ar' : 'en';
  }

  /** Safely render a top-courses row title (may be string or `{ en, ar }`). */
  topCourseTitle(c: TopCourse): string {
    return pickLocalized(c.title as never, this.uiLocale, '—') || '—';
  }

  /** Safely render the instructor cell (string, object, or null). */
  topCourseInstructor(c: TopCourse): string {
    const i = c.instructor;
    if (i === null || i === undefined) return '—';
    if (typeof i === 'string') return i || '—';
    return pickLocalized(i.name, this.uiLocale, '—') || '—';
  }

  /** Notification card — title fallback chain. */
  notificationTitle(n: DashboardNotification): string {
    return (
      pickLocalized(n.title, this.uiLocale, '') ||
      n.message ||
      '—'
    );
  }

  /** Notification card — detail fallback chain. */
  notificationDetail(n: DashboardNotification): string {
    return (
      pickLocalized(n.detail, this.uiLocale, '') ||
      n.meta ||
      ''
    );
  }

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

  /** Public reload — used by the locale-reload helper. */
  load(): void {
    this.fetch(this.trendRange());
  }

  /** Fetch the dashboard summary for the requested range. */
  private fetch(range: TrendRange): void {
    if (!this.data()) this.loading.set(true);
    this.dashboardApi.getSummary(range).subscribe({
      next: (res) => {
        this.data.set(res.result);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
