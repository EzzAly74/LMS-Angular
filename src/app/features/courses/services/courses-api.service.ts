import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { API, courseUrl } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import type { Course, CourseSession, CreateCoursePayload } from '../../../core/models/course.types';

@Injectable({ providedIn: 'root' })
export class CoursesApiService {
  private readonly api = inject(ApiService);

  list(params?: Record<string, string | number | boolean | null | undefined>): Observable<PaginatedResponse<Course>> {
    return this.api.getPaginated<Course>(API.COURSES, params);
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
}
