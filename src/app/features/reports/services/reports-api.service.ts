import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { QUIET_STATUSES } from '../../../core/interceptors/error.interceptor';
import { ApiParams, ApiService } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import { saveBlob } from '../../../core/utils/save-blob';
import type {
  ReportDefinition, ReportFilterOption, ReportFilterParams, ReportFormat, ReportPage,
} from '../models/report.model';

/** The NAS reports API (backend D-112). */
@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  catalog(): Observable<ReportDefinition[]> {
    return this.api.get<ReportDefinition[]>(API.ADMIN_REPORTS).pipe(map(r => r.result ?? []));
  }

  /** One page of the report's preview (Figma 2201:82041: a few key columns). */
  page(key: string, filters: ReportFilterParams, page: number, perPage: number): Observable<ReportPage> {
    const params: ApiParams = { ...this.params(filters), page, per_page: perPage, preview: 1 };
    return this.api.get<ReportPage>(`${API.ADMIN_REPORTS}/${encodeURIComponent(key)}`, params).pipe(map(r => r.result));
  }

  options(source: string, search: string, courseIds: readonly number[] = []): Observable<ReportFilterOption[]> {
    const params: ApiParams = {};
    if (search) params['search'] = search;
    if (courseIds.length) params['course_ids'] = [...courseIds];
    return this.api.get<ReportFilterOption[]>(`${API.ADMIN_REPORTS}/options/${encodeURIComponent(source)}`, params)
      .pipe(map(r => r.result ?? []));
  }

  /**
   * Download the export; the file name is the server's (Content-Disposition).
   * A refused export (422: too many rows, a bad filter) comes back as a Blob,
   * which the error interceptor cannot read: it is kept quiet there and the
   * server's message is returned here as a {@link ReportExportError}.
   */
  export(key: string, filters: ReportFilterParams, format: ReportFormat): Observable<void> {
    let params = new HttpParams().set('format', format);
    for (const [name, value] of Object.entries(this.params(filters))) {
      if (Array.isArray(value)) value.forEach(v => (params = params.append(`${name}[]`, String(v))));
      else params = params.set(name, String(value));
    }

    return this.download(`${API.ADMIN_REPORTS}/${encodeURIComponent(key)}/export`, params, `NAS-${key}.${format}`);
  }

  private download(url: string, params: HttpParams, fallbackName: string): Observable<void> {
    return this.http
      .get(url, {
        params, responseType: 'blob', observe: 'response', context: new HttpContext().set(QUIET_STATUSES, [422]),
      })
      .pipe(
        map((res: HttpResponse<Blob>) => {
          if (res.body) saveBlob(res.body, fileName(res.headers.get('Content-Disposition')) ?? fallbackName);
        }),
        catchError((err: unknown) => err instanceof HttpErrorResponse && err.status === 422 && err.error instanceof Blob
          ? from(err.error.text()).pipe(switchMap(text => throwError(() => new ReportExportError(messageOf(text)))))
          : throwError(() => err)),
      );
  }

  /** Every report the reader may open, one file each, in a zip (Figma 2201:81876, "Export All"). */
  exportAll(format: ReportFormat): Observable<void> {
    return this.download(`${API.ADMIN_REPORTS}/export-all`, new HttpParams().set('format', format), 'NAS-reports.zip');
  }

  private params(filters: ReportFilterParams): ApiParams {
    const out: ApiParams = {};
    for (const [key, value] of Object.entries(filters)) {
      out[key] = Array.isArray(value) ? [...value] : (value as string | number);
    }
    return out;
  }
}

/** An export the server refused, with its (translated) reason. */
export class ReportExportError extends Error {
  constructor(readonly reason: string | null) {
    super(reason ?? 'export refused');
  }
}

/** The `message` of a JSON error body, or null. */
function messageOf(text: string): string | null {
  try {
    const body: unknown = JSON.parse(text);
    return body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : null;
  } catch {
    return null;
  }
}

/** The file name of a Content-Disposition header (plain or RFC 5987 form). */
function fileName(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}
