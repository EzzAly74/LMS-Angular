import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API } from '../../../core/constants/api.constants';
import {
  ApiResponse,
  PaginatedResponse,
} from '../../../core/models/api-response.model';
import { ApiParams, ApiService } from '../../../core/services/api.service';
import type {
  AdminAuditLogFilterOptions,
  AdminAuditLogItem,
  AdminAuditLogQuery,
} from '../models/audit-log.types';

/**
 * Centralised API layer for the 2026 admin Audit Log overview.
 *
 * The export endpoint streams a raw CSV blob (Content-Type:
 * text/csv) and therefore bypasses the standard ApiService wrapper —
 * we use HttpClient directly with `responseType: 'blob'` so the
 * caller can trigger a browser download without paying for any JSON
 * normalisation overhead.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuditLogApiService {
  private readonly api  = inject(ApiService);
  private readonly http = inject(HttpClient);

  list(params?: AdminAuditLogQuery): Observable<PaginatedResponse<AdminAuditLogItem>> {
    return this.api.getPaginated<AdminAuditLogItem>(
      API.ADMIN_AUDIT_LOG,
      this.toApiParams(params),
    );
  }

  filterOptions(): Observable<ApiResponse<AdminAuditLogFilterOptions>> {
    return this.api.get<AdminAuditLogFilterOptions>(
      `${API.ADMIN_AUDIT_LOG}/filter-options`,
    );
  }

  /**
   * Trigger a CSV export honouring the supplied filters. The promise
   * resolves with the raw Blob; the caller is responsible for kicking
   * off the browser download (kept here to keep the side-effect at
   * the call site, not inside the service).
   */
  export(query?: AdminAuditLogQuery): Observable<Blob> {
    const httpParams = this.buildHttpParams(query);
    return this.http.get(`${API.ADMIN_AUDIT_LOG}/export`, {
      params: httpParams,
      responseType: 'blob',
    });
  }

  /* ------------------------------------------------------------------ *
   |  INTERNALS                                                         |
   * ------------------------------------------------------------------ */

  /**
   * Shape an AdminAuditLogQuery into the ApiParams contract consumed
   * by ApiService.getPaginated(). Numeric arrays are flattened to a
   * comma-joined string so they tunnel cleanly through the existing
   * HttpParams builder.
   */
  private toApiParams(query?: AdminAuditLogQuery): ApiParams {
    const out: ApiParams = {};
    if (!query) return out;

    if (query.page     !== undefined && query.page     !== null) out['page']     = query.page;
    if (query.per_page !== undefined && query.per_page !== null) out['per_page'] = query.per_page;
    if (query.search) out['search'] = query.search;
    if (query.role)   out['role']   = query.role;
    if (query.date_from) out['date_from'] = query.date_from;
    if (query.date_to)   out['date_to']   = query.date_to;
    if (query.instructor_ids?.length) {
      out['instructor_ids'] = query.instructor_ids.join(',');
    }
    return out;
  }

  /**
   * Build HttpParams for the export endpoint — same contract as the
   * list endpoint so the exported CSV reflects exactly what's on
   * screen.
   */
  private buildHttpParams(query?: AdminAuditLogQuery): HttpParams {
    let params = new HttpParams();
    if (!query) return params;

    if (query.search)    params = params.set('search',    query.search);
    if (query.role)      params = params.set('role',      query.role);
    if (query.date_from) params = params.set('date_from', query.date_from);
    if (query.date_to)   params = params.set('date_to',   query.date_to);
    if (query.instructor_ids?.length) {
      params = params.set('instructor_ids', query.instructor_ids.join(','));
    }
    return params;
  }
}
