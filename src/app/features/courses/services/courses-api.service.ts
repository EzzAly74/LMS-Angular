import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { API, courseUrl } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import type {
  Course, CourseSession, CreateCoursePayload,
  CourseModule, ModulePayload, CohortAttendance,
  Cohort, CohortPayload,
} from '../../../core/models/course.types';

@Injectable({ providedIn: 'root' })
export class CoursesApiService {
  private readonly api = inject(ApiService);

  list(params?: Record<string, string | number | boolean | null | undefined>): Observable<PaginatedResponse<Course>> {
    return this.api.getPaginated<Course>(API.COURSES, params);
  }

  /** Returns the count of courses in each admin tab in a single request. */
  getTabCounts(): Observable<ApiResponse<{
    all: number;
    active: number;
    inactive: number;
    pending: number;
    upcoming: number;
  }>> {
    return this.api.get(`${API.COURSES}/tab-counts`);
  }

  getById(id: number): Observable<ApiResponse<Course>> {
    return this.api.get<Course>(courseUrl.detail(id));
  }

  create(payload: FormData): Observable<ApiResponse<Course>> {
    return this.api.post<Course>(API.COURSES, payload);
  }

  update(id: number, payload: FormData | Record<string, unknown>): Observable<ApiResponse<Course>> {
    return this.api.put<Course>(courseUrl.detail(id), payload);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this.api.delete(courseUrl.detail(id));
  }

  listSessions(courseId: number, params?: Record<string, string | number | boolean | null | undefined>): Observable<PaginatedResponse<CourseSession>> {
    return this.api.getPaginated<CourseSession>(courseUrl.sessions(courseId), params);
  }

  createSession(courseId: number, body: Record<string, unknown>): Observable<ApiResponse<CourseSession>> {
    return this.api.post<CourseSession>(courseUrl.sessions(courseId), body);
  }

  updateSession(courseId: number, sessionId: number, body: Record<string, unknown>): Observable<ApiResponse<CourseSession>> {
    return this.api.put<CourseSession>(courseUrl.session(courseId, sessionId), body);
  }

  deleteSession(courseId: number, sessionId: number): Observable<ApiResponse<void>> {
    return this.api.delete(courseUrl.session(courseId, sessionId));
  }

  /* ── Cohorts (course_sections) ────────────────────────────────────── */

  /**
   * List of cohorts for the Cohort tab. Each row already includes
   * `enrolled_count`, `capacity`, `status`, `start_date`, `end_date`
   * and the EN/AR name pair, so the table needs no follow-up requests.
   */
  listCohorts(courseId: number): Observable<ApiResponse<Cohort[]>> {
    return this.api.get<Cohort[]>(courseUrl.cohorts(courseId));
  }

  createCohort(courseId: number, body: CohortPayload): Observable<ApiResponse<Cohort>> {
    return this.api.post<Cohort>(courseUrl.cohorts(courseId), body);
  }

  updateCohort(courseId: number, cohortId: number, body: CohortPayload): Observable<ApiResponse<Cohort>> {
    return this.api.put<Cohort>(courseUrl.cohort(courseId, cohortId), body);
  }

  deleteCohort(courseId: number, cohortId: number): Observable<ApiResponse<void>> {
    return this.api.delete(courseUrl.cohort(courseId, cohortId));
  }

  /* ── Modules (course_lectures, surfaced as "Modules" in the admin UI) ── */

  /** Flat list of every module belonging to a course, ordered by creation. */
  listModules(courseId: number): Observable<ApiResponse<CourseModule[]>> {
    return this.api.get<CourseModule[]>(courseUrl.modules(courseId));
  }

  createModule(courseId: number, body: ModulePayload): Observable<ApiResponse<CourseModule>> {
    return this.api.post<CourseModule>(courseUrl.lectures(courseId), body);
  }

  updateModule(courseId: number, moduleId: number, body: ModulePayload): Observable<ApiResponse<CourseModule>> {
    return this.api.put<CourseModule>(courseUrl.lecture(courseId, moduleId), body);
  }

  deleteModule(courseId: number, moduleId: number): Observable<ApiResponse<void>> {
    return this.api.delete(courseUrl.lecture(courseId, moduleId));
  }

  /* ── Enrollments (powers the Course → Learners tab) ──────────────── */

  /**
   * Paginated list of every learner enrolled in a course. The backend
   * endpoint covers both online (no group_id) and offline (with group_id)
   * enrollments in a single response, with the user + group eager-loaded.
   */
  listEnrollments(courseId: number, params?: Record<string, string | number | undefined>) {
    return this.api.getPaginated<unknown>(courseUrl.enrollments(courseId), params);
  }

  /* ── Cohort Attendance (powers the right-edge drawer on the detail page) ── */

  /**
   * One-shot rollup for the cohort attendance drawer. The backend assembles
   * the full matrix (sessions × learners + per-session absentees +
   * per-learner absent sessions + totals) so the drawer renders both tabs
   * and all three filter chips without further round-trips.
   *
   * `cohortId` is `course_sections.id` (the offline group / cohort), NOT
   * the legacy "session-as-cohort" id used elsewhere in the frontend.
   * Look up via `cohort.section_id` in the `Cohort` mapper.
   */
  getCohortAttendance(courseId: number, cohortId: number): Observable<ApiResponse<CohortAttendance>> {
    return this.api.get<CohortAttendance>(courseUrl.cohortAttendance(courseId, cohortId));
  }
}
