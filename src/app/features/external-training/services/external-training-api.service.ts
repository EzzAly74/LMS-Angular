import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiParams, ApiService } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { openDownload } from '../../../core/utils/save-blob';
import { ExternalTrainingRequest, RequestStats, RequestStatus, ReviewOptions } from '../models/external-training.model';

export interface RequestPage {
  rows: ExternalTrainingRequest[];
  total: number;
  stats: RequestStats;
}

interface RawList {
  result: ExternalTrainingRequest[];
  meta: { total: number; stats: RequestStats };
}

/**
 * admin/external-training (B5, D-057). Authorization is the API's
 * (view-external-training; reopen also needs superAdmin).
 */
@Injectable({ providedIn: 'root' })
export class ExternalTrainingApiService {
  private readonly api  = inject(ApiService);
  private readonly base = API.ADMIN_EXTERNAL_TRAINING;

  /** The list and its tiles come back in one response (tiles in meta). */
  list(page: number, perPage: number, search: string, statuses: RequestStatus[]): Observable<RequestPage> {
    const params: ApiParams = { page, per_page: perPage };
    if (search) params['search'] = search;
    if (statuses.length) params['statuses'] = statuses;
    return this.api.getRaw<RawList>(this.base, params).pipe(
      map(raw => ({ rows: raw.result, total: raw.meta.total, stats: raw.meta.stats })),
    );
  }

  stats(): Observable<RequestStats> {
    return this.api.get<RequestStats>(`${this.base}/stats`).pipe(map(r => r.result));
  }

  options(): Observable<ReviewOptions> {
    return this.api.get<ReviewOptions>(`${this.base}/options`).pipe(map(r => r.result));
  }

  get(id: number): Observable<ExternalTrainingRequest> {
    return this.api.get<ExternalTrainingRequest>(`${this.base}/${id}`).pipe(map(r => r.result));
  }

  approve(id: number, qualificationId: number | null, courseId: number | null): Observable<ExternalTrainingRequest> {
    return this.api.post<ExternalTrainingRequest>(`${this.base}/${id}/approve`, {
      qualification_skill_id: qualificationId,
      course_id: courseId,
    }).pipe(map(r => r.result));
  }

  reject(id: number, reason: string): Observable<ExternalTrainingRequest> {
    return this.api.post<ExternalTrainingRequest>(`${this.base}/${id}/reject`, { reason }).pipe(map(r => r.result));
  }

  reopen(id: number): Observable<ExternalTrainingRequest> {
    return this.api.post<ExternalTrainingRequest>(`${this.base}/${id}/reopen`, {}).pipe(map(r => r.result));
  }

  /**
   * Download the certificate through a signed link the API makes for this
   * reviewer (a few minutes long), not a token-bearing blob fetch: download
   * managers take over PDFs and abort the page's request (D-071).
   */
  certificate(row: ExternalTrainingRequest): Observable<void> {
    return this.api.get<{ url: string; expires_at: string }>(`${this.base}/${row.id}/certificate-link`).pipe(
      map(res => openDownload(res.result.url)),
    );
  }
}
