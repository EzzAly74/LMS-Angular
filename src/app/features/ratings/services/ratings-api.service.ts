import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiParams } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import type {
  RatingFilterOptions,
  RatingListItem,
  RatingSummary,
} from '../models/rating.types';

/**
 * Centralised API layer for the Admin Ratings overview.
 * All endpoints are served from /api/v1/admin/ratings.
 */
@Injectable({ providedIn: 'root' })
export class RatingsApiService {
  private readonly api = inject(ApiService);

  list(params?: ApiParams): Observable<PaginatedResponse<RatingListItem>> {
    return this.api.getPaginated<RatingListItem>(API.ADMIN_RATINGS, params);
  }

  summary(): Observable<ApiResponse<RatingSummary>> {
    return this.api.get<RatingSummary>(`${API.ADMIN_RATINGS}/summary`);
  }

  filterOptions(): Observable<ApiResponse<RatingFilterOptions>> {
    return this.api.get<RatingFilterOptions>(`${API.ADMIN_RATINGS}/filter-options`);
  }
}
