import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { saveBlob } from '../../../core/utils/save-blob';
import { ApiService, ApiParams } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import type {
  StoredFile,
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

  /* ── File questions (D-064) ─────────────────────────────────── */

  /** The learner's uploaded answer, saved under its original name. */
  downloadAnswerFile(submissionId: number, answerId: number, name: string): Observable<void> {
    return this.api.getBlob(`${API.ADMIN_ASSIGNMENTS}/submissions/${submissionId}/answers/${answerId}/file`)
      .pipe(map(blob => saveBlob(blob, name)));
  }

  /** The instructor's attachment on a file question. */
  downloadAttachment(assignmentId: number, questionId: number, name: string): Observable<void> {
    return this.api.getBlob(`${API.ADMIN_ASSIGNMENTS}/${assignmentId}/questions/${questionId}/attachment`)
      .pipe(map(blob => saveBlob(blob, name)));
  }

  uploadAttachment(assignmentId: number, questionId: number, file: File): Observable<ApiResponse<StoredFile>> {
    const body = new FormData();
    body.append('file', file);
    return this.api.post<StoredFile>(`${API.ADMIN_ASSIGNMENTS}/${assignmentId}/questions/${questionId}/attachment`, body);
  }

  removeAttachment(assignmentId: number, questionId: number): Observable<ApiResponse<void>> {
    return this.api.delete(`${API.ADMIN_ASSIGNMENTS}/${assignmentId}/questions/${questionId}/attachment`);
  }
}
