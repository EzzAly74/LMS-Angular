import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import { ApiService } from '../../../core/services/api.service';
import {
  CertificateTemplateOverview,
  IssuedCertificate,
} from '../models/certificate.types';

interface RawLaravelPaginated<T> {
  status: string;
  message: string;
  result: T[];
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
    from?: number;
    to?: number;
  };
}

/**
 * Client for `/api/v1/admin/certificates*` — the additive endpoints
 * powering the 2026 Certificates redesign.
 */
@Injectable({ providedIn: 'root' })
export class AdminCertificatesApiService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  /** GET /admin/certificates/template/overview */
  getOverview(): Observable<CertificateTemplateOverview> {
    return this.api
      .get<CertificateTemplateOverview>(`${API.ADMIN_CERTIFICATES}/template/overview`)
      .pipe(map(res => res.result));
  }

  /** POST /admin/certificates/template — multipart upload of the template file. */
  uploadTemplate(file: File): Observable<CertificateTemplateOverview> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http
      .post<ApiResponse<CertificateTemplateOverview>>(`${API.ADMIN_CERTIFICATES}/template`, fd)
      .pipe(map(res => res.result));
  }

  /**
   * GET /admin/certificates/template/file — returns the raw file as a
   * Blob so the caller can render it via `URL.createObjectURL()`.
   * Streamed through HttpClient so the auth interceptor adds the
   * Bearer token automatically.
   */
  getTemplateFileBlob(): Observable<Blob> {
    return this.http.get(`${API.ADMIN_CERTIFICATES}/template/file`, {
      responseType: 'blob',
    });
  }

  /** GET /admin/certificates — paginated issued certificates list. */
  listIssued(params: {
    page?: number;
    per_page?: number;
    search?: string;
    course_id?: number;
  }): Observable<PaginatedResponse<IssuedCertificate>> {
    return this.api.getPaginated<IssuedCertificate>(API.ADMIN_CERTIFICATES, params);
  }

  /**
   * GET /admin/certificates/{userId}/{courseId}/download — streams the
   * rendered certificate JPEG and triggers a browser download.
   */
  downloadIssued(userId: number, courseId: number, suggestedName?: string): Observable<void> {
    return this.http
      .get(`${API.ADMIN_CERTIFICATES}/${userId}/${courseId}/download`, {
        responseType: 'blob',
      })
      .pipe(
        map(blob => {
          const url  = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href     = url;
          link.download = suggestedName?.trim() ? suggestedName : `certificate-${userId}-${courseId}.jpg`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }),
      );
  }
}
