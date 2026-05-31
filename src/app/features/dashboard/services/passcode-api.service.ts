import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse } from '../../../core/models/api-response.model';

/**
 * Instructor-dashboard passcode widget contract — mirrors the additive
 * backend endpoints (`GET|POST /api/v1/dashboard/passcode`). The widget
 * never needs a session id up-front: the backend resolves the current
 * live session and we just read / generate against it.
 */
export type PasscodeState = 'idle' | 'live' | 'ended';

export interface PasscodeSession {
  id: number;
  /** 1-based ordinal of this session within its cohort. */
  number: number;
  title: string | null;
  /** ISO date (`YYYY-MM-DD`) or null for an undated session. */
  date: string | null;
  time_from: string | null;
  time_to: string | null;
  course_id: number;
  course_title: string | null;
  cohort_id: number | null;
  cohort_name: string | null;
}

export interface PasscodeCode {
  code: string;
  issued_at: string | null;
  expires_at: string | null;
  expired: boolean;
}

export interface PasscodeWidget {
  /**
   * True only when the viewer is an instructor who teaches courses.
   * When false the widget is hidden entirely (plain admins/super-admins
   * who don't run sessions never see it).
   */
  available: boolean;
  state: PasscodeState;
  passcode_length: number;
  session: PasscodeSession | null;
  passcode: PasscodeCode | null;
}

@Injectable({ providedIn: 'root' })
export class PasscodeApiService {
  private readonly api = inject(ApiService);

  /** Current live-session passcode state for the dashboard header. */
  current(): Observable<ApiResponse<PasscodeWidget>> {
    return this.api.get<PasscodeWidget>(API.DASHBOARD_PASSCODE);
  }

  /**
   * Generate / rotate the passcode for the current live session. The
   * backend returns a 422 (with a localized message) when no session is
   * live right now — the widget surfaces that as a toast.
   */
  generate(): Observable<ApiResponse<PasscodeWidget>> {
    return this.api.post<PasscodeWidget>(API.DASHBOARD_PASSCODE, {});
  }
}
