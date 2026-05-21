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
import { pickLocalized } from '../../../../core/utils/localized';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
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
  title: string | { en?: string; ar?: string } | null;
  instructor?: string | { id?: number; name?: string | { en?: string; ar?: string } } | null;
  /** May be missing if the backend hasn't computed the relation yet. */
  users_count?: number;
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

  constructor() {
    withLocaleReload(() => this.load());
  }

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

  /** Current trend series (real backend data when non-empty, otherwise generated demo data). */
  private readonly trendSeries = computed(() => {
    const range = this.trendRange();
    const backend = this.data()?.enrollment_trend ?? [];

    const hasRealData =
      backend.length > 0 &&
      backend.some((t) => (t.enrollments ?? 0) > 0 || (t.completions ?? 0) > 0);

    return hasRealData
      ? this.adaptBackendToRange(backend, range)
      : this.buildSampleSeries(range);
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

  load(): void {
    this.dashboardApi.getSummary().subscribe({
      next: (res) => {
        this.data.set(res.result);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /* ── Trend data helpers ───────────────────────────────────────────── */

  /**
   * Generate a realistic-looking demo series so the chart shows a curve
   * before any real activity is recorded. Always returns positive integers
   * with a mild upward bias and natural-looking variance.
   */
  private buildSampleSeries(range: TrendRange): {
    labels: string[];
    enrollments: number[];
    completions: number[];
  } {
    const config: Record<
      TrendRange,
      { points: number; step: 'day' | 'week' | 'month'; base: number; spread: number }
    > = {
      week:    { points: 7,  step: 'day',   base: 8,  spread: 6 },
      month:   { points: 30, step: 'day',   base: 12, spread: 10 },
      quarter: { points: 13, step: 'week',  base: 60, spread: 35 },
      year:    { points: 12, step: 'month', base: 240, spread: 110 },
    };

    const { points, step, base, spread } = config[range];
    const labels: string[] = [];
    const enrollments: number[] = [];
    const completions: number[] = [];

    const today = new Date();
    let seed = 0x9e3779b1;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0x7fffffff) / 0x7fffffff;
    };

    for (let i = points - 1; i >= 0; i--) {
      const d = new Date(today);
      if (step === 'day')   d.setDate(today.getDate() - i);
      if (step === 'week')  d.setDate(today.getDate() - i * 7);
      if (step === 'month') d.setMonth(today.getMonth() - i);

      // Soft sine + noise + mild upward trend, clamped to >= 1
      const t        = (points - 1 - i) / Math.max(1, points - 1);
      const wave     = Math.sin(t * Math.PI * 1.6) * 0.45 + 0.55;
      const trendUp  = 0.55 + t * 0.45;
      const noise    = (rng() - 0.5) * 0.4;
      const enroll   = Math.max(1, Math.round(base + wave * spread * trendUp + noise * spread));

      // Completions trail enrollments by ~55–80%
      const ratio    = 0.55 + rng() * 0.25;
      const complete = Math.max(0, Math.round(enroll * ratio));

      labels.push(this.formatLabel(d, step));
      enrollments.push(enroll);
      completions.push(complete);
    }

    return { labels, enrollments, completions };
  }

  /** Pick the right number of trailing buckets from backend data for the active range. */
  private adaptBackendToRange(
    backend: ReadonlyArray<{ date: string; enrollments: number; completions: number }>,
    range: TrendRange,
  ): { labels: string[]; enrollments: number[]; completions: number[] } {
    const take = { week: 7, month: 30, quarter: 90, year: 365 }[range];
    const slice = backend.slice(-take);
    return {
      labels:      slice.map((t) => this.formatLabel(new Date(t.date), 'day')),
      enrollments: slice.map((t) => t.enrollments ?? 0),
      completions: slice.map((t) => t.completions ?? 0),
    };
  }

  private formatLabel(d: Date, step: 'day' | 'week' | 'month'): string {
    if (step === 'month') {
      return d.toLocaleDateString(undefined, { month: 'short' });
    }
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }
}
