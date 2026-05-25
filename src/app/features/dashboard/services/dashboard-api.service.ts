import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse } from '../../../core/models/api-response.model';

/**
 * One row in the dashboard's "recent notifications" card. Mirrors the
 * `public_notifications` table (same source as the notifications drawer
 * and `/api/v1/notifications`) so a single admin store powers both
 * surfaces — no synthetic, locale-baked entries are ever emitted.
 */
export interface DashboardNotification {
  id?: number;
  /** Translatable JSON column (`{ ar, en }`) — never a baked string. */
  title?: { ar?: string; en?: string } | string;
  /** Translatable JSON column (`{ ar, en }`) — never a baked string. */
  body?: { ar?: string; en?: string } | string;
  for_public?: boolean;
  /** ISO-8601 timestamp; the UI derives the relative chip. */
  created_at?: string | null;
}

export interface DashboardStatistics {
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

export type DashboardTrendRange = 'week' | 'month' | 'quarter' | 'year';

export interface DashboardData {
  statistics: DashboardStatistics;
  top_courses: Array<{
    id: number;
    title: string | { en?: string; ar?: string } | null;
    /**
     * Either a flat name (current backend) or a relation object — kept loose
     * so a future contract change doesn't break the dashboard.
     */
    instructor?: string | { id?: number; name?: string | { en?: string; ar?: string } } | null;
    users_count?: number;
    completion_percent?: number;
    status?: string;
  }>;
  /**
   * Pre-bucketed enrollment trend matching the requested `range`. Always
   * returned with labels & zero-filled rows — the chart should never
   * fabricate or interpolate data on the client.
   */
  enrollment_trend?: Array<{
    date: string;
    label: string;
    enrollments: number;
    completions: number;
  }>;
  trend_range?: DashboardTrendRange;
  notifications?: DashboardNotification[];
}

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly api = inject(ApiService);

  /**
   * Fetch the admin dashboard summary, optionally requesting the chart
   * range. The backend resolves an unrecognised range to `month`, so the
   * frontend never has to guess.
   */
  getSummary(range?: DashboardTrendRange): Observable<ApiResponse<DashboardData>> {
    const params = range ? { range } : undefined;
    return this.api.get<DashboardData>(API.DASHBOARD, params);
  }
}
