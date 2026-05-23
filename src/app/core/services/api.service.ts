import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, PaginatedResponse } from '../models/api-response.model';

/**
 * Raw shape returned by Laravel's ApiResponse::paginated() trait.
 * `result` is the items array and pagination metadata lives on the sibling `meta` key.
 * We normalize it into PaginatedResponse<T> for all consumers.
 */
interface RawLaravelPaginated<T> {
  status: 'success' | 'error' | 'fail';
  message: string;
  result: T[] | { data?: T[]; total?: number; current_page?: number; last_page?: number; per_page?: number; from?: number; to?: number };
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
    from?: number;
    to?: number;
  };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  get<T>(url: string, params?: ApiParams): Observable<ApiResponse<T>> {
    const httpParams = this.buildParams(params);
    return this.http.get<ApiResponse<T>>(url, { params: httpParams });
  }

  getPaginated<T>(url: string, params?: ApiParams): Observable<PaginatedResponse<T>> {
    const httpParams = this.buildParams(params);
    return this.http
      .get<RawLaravelPaginated<T>>(url, { params: httpParams })
      .pipe(map(res => this.normalizePaginated<T>(res)));
  }

  private normalizePaginated<T>(res: RawLaravelPaginated<T>): PaginatedResponse<T> {
    const meta = res.meta ?? {};
    let data: T[] = [];
    let total = meta.total ?? 0;
    let currentPage = meta.current_page ?? 1;
    let lastPage    = meta.last_page    ?? 1;
    let perPage     = meta.per_page     ?? 15;
    let from        = meta.from         ?? 0;
    let to          = meta.to           ?? 0;

    if (Array.isArray(res.result)) {
      data = res.result;
      if (!meta.total) total = data.length;
    } else if (res.result && typeof res.result === 'object') {
      const r = res.result as { data?: T[]; total?: number; current_page?: number; last_page?: number; per_page?: number; from?: number; to?: number };
      data        = Array.isArray(r.data) ? r.data : [];
      total       = r.total        ?? total;
      currentPage = r.current_page ?? currentPage;
      lastPage    = r.last_page    ?? lastPage;
      perPage     = r.per_page     ?? perPage;
      from        = r.from         ?? from;
      to          = r.to           ?? to;
    }

    return {
      status:  res.status,
      message: res.message,
      result: {
        data,
        total,
        current_page: currentPage,
        last_page:    lastPage,
        per_page:     perPage,
        from,
        to,
      },
    };
  }

  post<T>(url: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(url, body);
  }

  put<T>(url: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(url, body);
  }

  delete<T = void>(url: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(url);
  }

  private buildParams(params?: ApiParams): HttpParams {
    let p = new HttpParams();
    if (!params) return p;
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      if (Array.isArray(v)) {
        v.forEach(item => {
          if (item !== null && item !== undefined) {
            p = p.append(`${k}[]`, String(item));
          }
        });
        return;
      }
      p = p.set(k, String(v));
    });
    return p;
  }
}

/** Acceptable value types for query string parameters. */
export type ApiParamValue =
  | string | number | boolean | null | undefined
  | Array<string | number>;

/** Convenience alias for params objects passed to ApiService.get/getPaginated. */
export type ApiParams = Record<string, ApiParamValue>;
