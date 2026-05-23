import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiParams } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse } from '../../../core/models/api-response.model';
import type {
  AdminRoleDetail,
  AdminRoleListResponse,
  AdminRoleSectionCatalog,
  AdminRoleStorePayload,
  AdminRoleUpdatePayload,
} from '../models/role.types';

/**
 * Centralised API layer for the 2026 admin Roles overview.
 *
 * The endpoint set is intentionally non-paginated — the Figma renders a
 * 2-column card grid that the admin scans at a glance, and the total
 * number of roles is bounded.
 */
@Injectable({ providedIn: 'root' })
export class AdminRolesApiService {
  private readonly api = inject(ApiService);

  list(params?: ApiParams): Observable<ApiResponse<AdminRoleListResponse>> {
    return this.api.get<AdminRoleListResponse>(API.ADMIN_ROLES, params);
  }

  sections(): Observable<ApiResponse<AdminRoleSectionCatalog>> {
    return this.api.get<AdminRoleSectionCatalog>(`${API.ADMIN_ROLES}/sections`);
  }

  show(id: number): Observable<ApiResponse<AdminRoleDetail>> {
    return this.api.get<AdminRoleDetail>(`${API.ADMIN_ROLES}/${id}`);
  }

  create(payload: AdminRoleStorePayload): Observable<ApiResponse<AdminRoleDetail>> {
    return this.api.post<AdminRoleDetail>(API.ADMIN_ROLES, payload);
  }

  update(id: number, payload: AdminRoleUpdatePayload): Observable<ApiResponse<AdminRoleDetail>> {
    return this.api.put<AdminRoleDetail>(`${API.ADMIN_ROLES}/${id}`, payload);
  }

  destroy(id: number): Observable<ApiResponse<null>> {
    return this.api.delete<null>(`${API.ADMIN_ROLES}/${id}`);
  }
}
