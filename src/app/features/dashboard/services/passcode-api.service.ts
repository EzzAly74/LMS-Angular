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
  /**
   * True when the platform is in "rotating passcode" mode (Course
   * Attendance = No). The widget then runs a live countdown and
   * automatically re-issues a fresh code every `reset_seconds`.
   */
  rotates: boolean;
  /** Rotation interval in seconds (drives the countdown + auto-refresh). */
  reset_seconds: number | null;
  session: PasscodeSession | null;
  passcode: PasscodeCode | null;
}

/** A cohort the instructor can start a session for (not yet ended). */
export interface EligibleCohort {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

/** A course (+ its runnable cohorts) for the start-session pickers. */
export interface EligibleCourse {
  id: number;
  title: string;
  cohorts: EligibleCohort[];
}

@Injectable({ providedIn: 'root' })
export class PasscodeApiService {
  private readonly api = inject(ApiService);

  /** Current live-session passcode state for the dashboard header. */
  current(): Observable<ApiResponse<PasscodeWidget>> {
    return this.api.get<PasscodeWidget>(API.DASHBOARD_PASSCODE);
  }

  /**
   * Courses (+ cohorts) the instructor can start a session for. Courses
   * whose cohorts have all ended are excluded server-side.
   */
  courses(): Observable<ApiResponse<EligibleCourse[]>> {
    return this.api.get<EligibleCourse[]>(API.DASHBOARD_PASSCODE_COURSES);
  }

  /**
   * Start a session for the chosen course + cohort (today, beginning now)
   * and issue its passcode. The backend returns a 422 (with a localized
   * message) when the cohort isn't a valid target — surfaced as a toast.
   */
  start(courseId: number, cohortId: number): Observable<ApiResponse<PasscodeWidget>> {
    return this.api.post<PasscodeWidget>(API.DASHBOARD_PASSCODE, {
      course_id: courseId,
      cohort_id: cohortId,
    });
  }

  /**
   * Rotate (re-issue) the passcode on the instructor's currently-live
   * session — powers both the manual "Regenerate" button and the
   * rotating-passcode auto-refresh. The backend returns the read-only
   * current state when there is nothing live to rotate.
   */
  regenerate(): Observable<ApiResponse<PasscodeWidget>> {
    return this.api.post<PasscodeWidget>(API.DASHBOARD_PASSCODE_REGENERATE, {});
  }

  /**
   * End the instructor's current live session — revokes the passcode and
   * closes the attendance window. Returns the refreshed (idle) state.
   */
  end(): Observable<ApiResponse<PasscodeWidget>> {
    return this.api.post<PasscodeWidget>(API.DASHBOARD_PASSCODE_END, {});
  }
}
