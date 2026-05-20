import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse } from '../../../core/models/api-response.model';

export interface DashboardNotification {
  title?: string;
  detail?: string;
  message?: string;
  meta?: string;
  time?: string;
  type?: 'critical' | 'warning' | 'info';
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

export interface DashboardData {
  statistics: DashboardStatistics;
  top_courses: Array<{
    id: number;
    title: string;
    instructor?: string;
    users_count: number;
    completion_percent?: number;
    status?: string;
  }>;
  enrollment_trend?: Array<{ date: string; enrollments: number; completions: number }>;
  notifications?: DashboardNotification[];
}

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly api = inject(ApiService);

  getSummary(): Observable<ApiResponse<DashboardData>> {
    return this.api.get<DashboardData>(API.DASHBOARD);
  }
}
