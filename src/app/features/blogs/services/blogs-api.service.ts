import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.model';
import { AdminBlog, BlogListItem, QualificationOption, UserOption } from '../models/blog.types';

/**
 * Dashboard-facing Blog API. Reads/writes the admin blog endpoints
 * (`/api/v1/admin/blogs`) — create/update go out as multipart FormData
 * (cover + per-section images), update spoofs PUT via `_method`.
 */
@Injectable({ providedIn: 'root' })
export class BlogsApiService {
  private readonly api = inject(ApiService);

  list(params: Record<string, string | number>): Observable<PaginatedResponse<BlogListItem>> {
    return this.api.getPaginated<BlogListItem>(API.BLOGS, params);
  }

  get(id: number): Observable<ApiResponse<AdminBlog>> {
    return this.api.get<AdminBlog>(`${API.BLOGS}/${id}`);
  }

  create(payload: FormData): Observable<ApiResponse<AdminBlog>> {
    return this.api.post<AdminBlog>(API.BLOGS, payload);
  }

  update(id: number, payload: FormData): Observable<ApiResponse<AdminBlog>> {
    payload.append('_method', 'PUT');
    return this.api.post<AdminBlog>(`${API.BLOGS}/${id}`, payload);
  }

  remove(id: number): Observable<ApiResponse<void>> {
    return this.api.delete(`${API.BLOGS}/${id}`);
  }

  qualifications(): Observable<QualificationOption[]> {
    return this.api
      .get<QualificationOption[]>(API.QUALIFICATIONS_ACTIVE)
      .pipe(map(res => (Array.isArray(res.result) ? res.result : [])));
  }

  /** Owner picker — server-side searched so we never load the whole roster. */
  users(search?: string): Observable<UserOption[]> {
    const params: Record<string, string | number> = { per_page: 50 };
    if (search?.trim()) params['search'] = search.trim();
    return this.api.getPaginated<Record<string, unknown>>(API.USERS, params).pipe(
      map(res =>
        res.result.data.map(u => ({
          id: Number(u['id']),
          name: String(u['name'] ?? u['name_en'] ?? u['name_ar'] ?? `#${u['id']}`),
        })),
      ),
    );
  }
}
