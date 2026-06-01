import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiParams } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import type {
  AdminUserDetail,
  AdminUserFilterOptions,
  AdminUserListItem,
  AdminUserSource,
  AdminUserStorePayload,
  AdminUserSummary,
  AdminUserUpdatePayload,
} from '../models/user.types';

/**
 * Centralised API layer for the 2026 admin Users overview.
 *
 * The backend maintains three sibling person-tables (users / instructors /
 * admins) which the Figma redesign surfaces in a single unified list.
 * Item-level endpoints therefore key on a (source, id) pair carried in the
 * URL — every row coming back from `list()` exposes the `source` field so
 * the caller knows which sub-path to use.
 */
@Injectable({ providedIn: 'root' })
export class AdminUsersApiService {
  private readonly api = inject(ApiService);

  list(params?: ApiParams): Observable<PaginatedResponse<AdminUserListItem>> {
    return this.api.getPaginated<AdminUserListItem>(API.ADMIN_USERS, params);
  }

  summary(): Observable<ApiResponse<AdminUserSummary>> {
    return this.api.get<AdminUserSummary>(`${API.ADMIN_USERS}/summary`);
  }

  filterOptions(): Observable<ApiResponse<AdminUserFilterOptions>> {
    return this.api.get<AdminUserFilterOptions>(`${API.ADMIN_USERS}/filter-options`);
  }

  show(source: AdminUserSource, id: number): Observable<ApiResponse<AdminUserDetail>> {
    return this.api.get<AdminUserDetail>(`${API.ADMIN_USERS}/${source}/${id}`);
  }

  create(payload: AdminUserStorePayload): Observable<ApiResponse<AdminUserDetail>> {
    return this.api.post<AdminUserDetail>(API.ADMIN_USERS, this.toBody(payload));
  }

  update(
    source: AdminUserSource,
    id: number,
    payload: AdminUserUpdatePayload,
  ): Observable<ApiResponse<AdminUserDetail>> {
    const body = this.toBody(payload);
    // Multipart payloads can't ride on PUT in Laravel; tunnel through
    // POST with `_method=PUT` whenever we're sending FormData so the
    // avatar upload still hits AdminUserController::update().
    if (body instanceof FormData) {
      body.append('_method', 'PUT');
      return this.api.post<AdminUserDetail>(`${API.ADMIN_USERS}/${source}/${id}`, body);
    }
    return this.api.put<AdminUserDetail>(`${API.ADMIN_USERS}/${source}/${id}`, body);
  }

  /**
   * Serialise a store/update payload. Falls back to a plain JSON object
   * when no image is attached so we don't pay the multipart overhead on
   * every CRUD call.
   */
  private toBody(payload: AdminUserStorePayload | AdminUserUpdatePayload): FormData | Record<string, unknown> {
    if (!payload || !('image' in payload) || !(payload.image instanceof File)) {
      const { image: _ignored, ...rest } = (payload ?? {}) as AdminUserStorePayload;
      return rest as Record<string, unknown>;
    }

    const fd = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (value instanceof File) {
        fd.append(key, value);
      } else if (typeof value === 'boolean') {
        fd.append(key, value ? '1' : '0');
      } else {
        fd.append(key, String(value));
      }
    });
    return fd;
  }

  deactivate(source: AdminUserSource, id: number): Observable<ApiResponse<AdminUserDetail>> {
    return this.api.delete<AdminUserDetail>(`${API.ADMIN_USERS}/${source}/${id}`);
  }

  reactivate(source: AdminUserSource, id: number): Observable<ApiResponse<AdminUserDetail>> {
    return this.api.patch<AdminUserDetail>(`${API.ADMIN_USERS}/${source}/${id}/reactivate`);
  }
}
