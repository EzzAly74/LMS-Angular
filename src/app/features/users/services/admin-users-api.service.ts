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
    return this.api.post<AdminUserDetail>(API.ADMIN_USERS, payload);
  }

  update(
    source: AdminUserSource,
    id: number,
    payload: AdminUserUpdatePayload,
  ): Observable<ApiResponse<AdminUserDetail>> {
    return this.api.put<AdminUserDetail>(`${API.ADMIN_USERS}/${source}/${id}`, payload);
  }

  deactivate(source: AdminUserSource, id: number): Observable<ApiResponse<AdminUserDetail>> {
    return this.api.delete<AdminUserDetail>(`${API.ADMIN_USERS}/${source}/${id}`);
  }
}
