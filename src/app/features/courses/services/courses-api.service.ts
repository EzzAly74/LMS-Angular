import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, map, of, switchMap, tap, throwError, timer, catchError, retry } from 'rxjs';
import { QUIET_STATUSES } from '../../../core/interceptors/error.interceptor';
import { ApiService, ApiParams } from '../../../core/services/api.service';
import { API, API_BASE, courseUrl } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import type {
  Course, CourseSession, CreateCoursePayload,
  CourseModule, CourseContentItem, ModulePayload, ModuleUploadResult, CohortAttendance,
  Cohort, CohortPayload,
} from '../../../core/models/course.types';
import { saveBlob } from '../../../core/utils/save-blob';
import type { CourseFormSource } from '../models/course-form.model';
import type { CohortScheduleUpdate, CourseEvaluationSummary, CourseLearnerRow, CourseSubmissionRow } from '../models/course-detail.model';
import type { TemplateResults } from '../../evaluations/models/evaluation.model';

/** A part of a module file could not be sent (after retries): the caller says so once. */
export class ModuleUploadError extends Error {
  constructor(readonly reason: unknown) {
    super('Module upload failed');
    this.name = 'ModuleUploadError';
  }
}

@Injectable({ providedIn: 'root' })
export class CoursesApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

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

  /** Multipart edit: Laravel cannot parse a multipart PUT, so POST with `_method=PUT`. */
  updateMultipart(id: number, payload: FormData): Observable<ApiResponse<Course>> {
    payload.set('_method', 'PUT');
    return this.api.post<Course>(courseUrl.detail(id), payload);
  }

  /** The raw detail payload, typed as the Add / Edit Course modal reads it. */
  getForForm(id: number): Observable<ApiResponse<CourseFormSource>> {
    return this.api.get<CourseFormSource>(courseUrl.detail(id));
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

  /** "Download Schedule Template": one numbered row per planned session. */
  downloadScheduleTemplate(courseId: number): Observable<void> {
    return this.api.getBlob(courseUrl.cohortScheduleTemplate(courseId))
      .pipe(map(blob => saveBlob(blob, 'cohort-schedule-template.xlsx')));
  }

  /**
   * New Cohort with its completed schedule. All-or-nothing on the server: a
   * 422 carries every problem under `report.errors` (NasImportProblem rows).
   */
  createCohortWithSchedule(courseId: number, body: { name_en: string; name_ar: string; capacity: number | null; schedule: File }): Observable<ApiResponse<Cohort>> {
    const form = new FormData();
    form.append('name[en]', body.name_en);
    form.append('name[ar]', body.name_ar);
    if (body.capacity !== null) form.append('capacity', String(body.capacity));
    form.append('schedule', body.schedule, body.schedule.name);
    return this.api.post<Cohort>(courseUrl.cohortScheduled(courseId), form);
  }

  /** Edit Cohort "Download Schedule Template": the cohort's sessions, then blank rows for new ones. */
  downloadCohortSchedule(courseId: number, cohortId: number): Observable<void> {
    return this.api.getBlob(courseUrl.cohortSectionScheduleTemplate(courseId, cohortId))
      .pipe(map(blob => saveBlob(blob, 'cohort-schedule.xlsx')));
  }

  /**
   * Edit Cohort: names, capacity and, optionally, the schedule again, of which
   * the server adds only the new sessions (held ones never change). A 422
   * carries every problem under `report.errors`, and nothing is saved.
   */
  updateCohortWithSchedule(courseId: number, cohortId: number, body: { name_en: string; name_ar: string; capacity: number | null; schedule: File | null }): Observable<ApiResponse<CohortScheduleUpdate>> {
    const form = new FormData();
    form.append('name[en]', body.name_en);
    form.append('name[ar]', body.name_ar);
    if (body.capacity !== null) form.append('capacity', String(body.capacity));
    if (body.schedule) form.append('schedule', body.schedule, body.schedule.name);
    return this.api.post<CohortScheduleUpdate>(courseUrl.cohortSectionScheduled(courseId, cohortId), form);
  }

  /* ── Modules (course_lectures, surfaced as "Modules" in the admin UI) ── */

  /** Flat list of every module belonging to a course, ordered by creation. */
  listModules(courseId: number): Observable<ApiResponse<CourseModule[]>> {
    return this.api.get<CourseModule[]>(courseUrl.modules(courseId));
  }

  /** The Content tab's list: modules, quizzes and assignments (D-109). */
  listContent(courseId: number): Observable<ApiResponse<CourseContentItem[]>> {
    return this.api.get<CourseContentItem[]>(courseUrl.content(courseId));
  }

  /** Multipart upload for a module's video (mp4 …) or document attachment. */
  /**
   * A module file in parts (D-111): a lesson video is larger than one request
   * may be. Start, send each part at its offset (a 409 says where to resume;
   * a network or server error is retried three times), then complete, which
   * answers as the one-request upload did. `progress` gets 0..1.
   */
  uploadModuleFile(courseId: number, file: File, progress?: (fraction: number) => void): Observable<ApiResponse<ModuleUploadResult>> {
    const base = `${courseUrl.lectures(courseId)}/uploads`;
    const quiet = new HttpContext().set(QUIET_STATUSES, [0, 409, 500, 502, 503, 504]);
    const headers = new HttpHeaders({ 'Content-Type': 'application/octet-stream' });

    return this.api.post<{ id: string; chunk_size: number; received: number }>(base, { name: file.name, size: file.size }).pipe(
      switchMap(start => {
        const { id, chunk_size } = start.result;
        const send = (offset: number): Observable<number> => offset >= file.size ? of(offset)
          : this.http.put<ApiResponse<{ received: number }>>(`${base}/${id}`, file.slice(offset, offset + chunk_size), {
              params: { offset }, headers, context: quiet,
            }).pipe(
              map(r => r.result.received),
              // Out of step (a part arrived twice or not at all): resume where the server is.
              catchError((e: unknown) => e instanceof HttpErrorResponse && e.status === 409 && typeof e.error?.result?.received === 'number'
                ? of(e.error.result.received as number) : throwError(() => e)),
              retry({ count: 3, delay: (e: unknown, n: number) => e instanceof HttpErrorResponse && e.status >= 400 && e.status < 500
                ? throwError(() => e) : timer(1000 * n) }),
              tap(received => progress?.(received / file.size)),
              switchMap(received => send(received)),
            );
        return send(start.result.received).pipe(
          catchError((e: unknown) => throwError(() => new ModuleUploadError(e))),
          switchMap(() => this.api.post<ModuleUploadResult>(`${base}/${id}/complete`, {})),
        );
      }),
    );
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

  /* ── Enrollments (Course Details Learners tab, cohort learners modal) ── */

  /**
   * One page of a course's learners with progress. Filters: `search` (name or
   * employee id), `status` (progress band), `group_id` (a cohort of this
   * course); `per_page` up to 100.
   */
  listLearners(courseId: number, params?: ApiParams): Observable<PaginatedResponse<CourseLearnerRow>> {
    return this.api.getPaginated<CourseLearnerRow>(courseUrl.enrollments(courseId), params);
  }

  /* ── Quizzes / Assignments tabs: the admin submission lists, one course ── */

  quizSubmissions(courseId: number, params?: ApiParams): Observable<PaginatedResponse<CourseSubmissionRow>> {
    return this.api.getPaginated<CourseSubmissionRow>(`${API.ADMIN_QUIZZES}/submissions`, { ...params, course_id: courseId });
  }

  assignmentSubmissions(courseId: number, params?: ApiParams): Observable<PaginatedResponse<CourseSubmissionRow>> {
    return this.api.getPaginated<CourseSubmissionRow>(`${API.ADMIN_ASSIGNMENTS}/submissions`, { ...params, course_id: courseId });
  }

  /* ── Evaluations (Overview card, Evaluations tab) ─────────────────── */

  evaluationSummary(courseId: number): Observable<ApiResponse<CourseEvaluationSummary>> {
    return this.api.get<CourseEvaluationSummary>(`${API_BASE}/admin/courses/${courseId}/evaluation-summary`);
  }

  /** One template's per-question results, counting this course's answers only. */
  templateResults(templateId: number, courseId: number): Observable<ApiResponse<TemplateResults>> {
    return this.api.get<TemplateResults>(`${API.ADMIN_EVALUATIONS}/${templateId}/results`, { course_id: courseId });
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
