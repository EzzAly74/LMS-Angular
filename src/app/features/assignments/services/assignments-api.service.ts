import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiParams } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import type {
  Assignment,
  AssignmentListItem,
  AssignmentOption,
  AssignmentSavePayload,
  AssignmentSummary,
  CohortLite,
  InstructorOption,
  SubmissionDetail,
  SubmissionListItem,
} from '../models/assignment.types';

/**
 * Centralized API layer for the rich-question Admin Assignment workflow.
 * All endpoints are served from /api/v1/admin/assignments.
 */
@Injectable({ providedIn: 'root' })
export class AssignmentsApiService {
  private readonly api = inject(ApiService);

  /* ── Lookups ─────────────────────────────────────────────────── */

  summary(): Observable<ApiResponse<AssignmentSummary>> {
    return this.api.get<AssignmentSummary>(`${API.ADMIN_ASSIGNMENTS}/summary`);
  }

  listMinimal(search?: string): Observable<ApiResponse<AssignmentOption[]>> {
    return this.api.get<AssignmentOption[]>(`${API.ADMIN_ASSIGNMENTS}/list`, {
      ...(search ? { search } : {}),
    });
  }

  cohorts(courseId?: number | null): Observable<ApiResponse<CohortLite[]>> {
    return this.api.get<CohortLite[]>(`${API.ADMIN_ASSIGNMENTS}/cohorts`, {
      ...(courseId ? { course_id: courseId } : {}),
    });
  }

  instructors(): Observable<ApiResponse<InstructorOption[]>> {
    return this.api.get<InstructorOption[]>(`${API.ADMIN_ASSIGNMENTS}/instructors`);
  }

  /* ── Assignments CRUD ────────────────────────────────────────── */

  list(params?: ApiParams): Observable<PaginatedResponse<AssignmentListItem>> {
    return this.api.getPaginated<AssignmentListItem>(API.ADMIN_ASSIGNMENTS, params);
  }

  get(id: number): Observable<ApiResponse<Assignment>> {
    return this.api.get<Assignment>(`${API.ADMIN_ASSIGNMENTS}/${id}`);
  }

  create(payload: AssignmentSavePayload): Observable<ApiResponse<Assignment>> {
    return this.api.post<Assignment>(API.ADMIN_ASSIGNMENTS, payload);
  }

  update(id: number, payload: AssignmentSavePayload): Observable<ApiResponse<Assignment>> {
    return this.api.put<Assignment>(`${API.ADMIN_ASSIGNMENTS}/${id}`, payload);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this.api.delete(`${API.ADMIN_ASSIGNMENTS}/${id}`);
  }

  /* ── Submissions ─────────────────────────────────────────────── */

  listSubmissions(params?: ApiParams): Observable<PaginatedResponse<SubmissionListItem>> {
    return this.api.getPaginated<SubmissionListItem>(`${API.ADMIN_ASSIGNMENTS}/submissions`, params);
  }

  getSubmission(id: number): Observable<ApiResponse<SubmissionDetail>> {
    return this.api.get<SubmissionDetail>(`${API.ADMIN_ASSIGNMENTS}/submissions/${id}`);
  }

  gradeAnswer(
    submissionId: number,
    answerId: number,
    body: { awarded_score: number; feedback?: string | null },
  ): Observable<ApiResponse<{ submission: SubmissionDetail }>> {
    return this.api.put<{ submission: SubmissionDetail }>(
      `${API.ADMIN_ASSIGNMENTS}/submissions/${submissionId}/answers/${answerId}/grade`,
      body,
    );
  }
}
