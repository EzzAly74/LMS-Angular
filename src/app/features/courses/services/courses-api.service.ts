import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { API, courseUrl } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import type {
  Course, CourseSession, CreateCoursePayload,
  CourseModule, ModulePayload,
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
}
