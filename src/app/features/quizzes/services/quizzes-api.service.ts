import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiParams } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import type {
  CohortLite,
  Quiz,
  QuizInstructorOption,
  QuizListItem,
  QuizOption,
  QuizSavePayload,
  QuizSubmissionDetail,
  QuizSubmissionListItem,
  QuizSummary,
} from '../models/quiz.types';

/**
 * Centralized API layer for the rich-question Admin Quiz workflow.
 * All endpoints are served from /api/v1/admin/quizzes.
 */
@Injectable({ providedIn: 'root' })
export class QuizzesApiService {
  private readonly api = inject(ApiService);

  /* ── Lookups ─────────────────────────────────────────────────── */

  summary(): Observable<ApiResponse<QuizSummary>> {
    return this.api.get<QuizSummary>(`${API.ADMIN_QUIZZES}/summary`);
  }

  listMinimal(search?: string): Observable<ApiResponse<QuizOption[]>> {
    return this.api.get<QuizOption[]>(`${API.ADMIN_QUIZZES}/list`, {
      ...(search ? { search } : {}),
    });
  }

  cohorts(courseId?: number | null): Observable<ApiResponse<CohortLite[]>> {
    return this.api.get<CohortLite[]>(`${API.ADMIN_QUIZZES}/cohorts`, {
      ...(courseId ? { course_id: courseId } : {}),
    });
  }

  instructors(): Observable<ApiResponse<QuizInstructorOption[]>> {
    return this.api.get<QuizInstructorOption[]>(`${API.ADMIN_QUIZZES}/instructors`);
  }

  /* ── Quizzes CRUD ────────────────────────────────────────────── */

  list(params?: ApiParams): Observable<PaginatedResponse<QuizListItem>> {
    return this.api.getPaginated<QuizListItem>(API.ADMIN_QUIZZES, params);
  }

  get(id: number): Observable<ApiResponse<Quiz>> {
    return this.api.get<Quiz>(`${API.ADMIN_QUIZZES}/${id}`);
  }

  create(payload: QuizSavePayload): Observable<ApiResponse<Quiz>> {
    return this.api.post<Quiz>(API.ADMIN_QUIZZES, payload);
  }

  update(id: number, payload: QuizSavePayload): Observable<ApiResponse<Quiz>> {
    return this.api.put<Quiz>(`${API.ADMIN_QUIZZES}/${id}`, payload);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this.api.delete(`${API.ADMIN_QUIZZES}/${id}`);
  }

  /* ── Submissions ─────────────────────────────────────────────── */

  listSubmissions(params?: ApiParams): Observable<PaginatedResponse<QuizSubmissionListItem>> {
    return this.api.getPaginated<QuizSubmissionListItem>(
      `${API.ADMIN_QUIZZES}/submissions`,
      params,
    );
  }

  getSubmission(id: number): Observable<ApiResponse<QuizSubmissionDetail>> {
    return this.api.get<QuizSubmissionDetail>(`${API.ADMIN_QUIZZES}/submissions/${id}`);
  }

  gradeAnswer(
    submissionId: number,
    answerId: number,
    body: { awarded_score: number; feedback?: string | null },
  ): Observable<ApiResponse<{ submission: QuizSubmissionDetail }>> {
    return this.api.put<{ submission: QuizSubmissionDetail }>(
      `${API.ADMIN_QUIZZES}/submissions/${submissionId}/answers/${answerId}/grade`,
      body,
    );
  }
}
