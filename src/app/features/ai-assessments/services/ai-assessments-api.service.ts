import { HttpClient, HttpContext, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { API } from '../../../core/constants/api.constants';
import { QUIET_STATUSES } from '../../../core/interceptors/error.interceptor';
import type { ApiResponse } from '../../../core/models/api-response.model';
import { ApiService } from '../../../core/services/api.service';
import { contentDispositionName, saveBlob } from '../../../core/utils/save-blob';
import type {
  AiAssessment, AiAssessmentDetails, AiAssessmentRow, AiLibraryFilters, AiQuestion, AiQuestionPayload, AiSource,
  AiUsage, ExportFormat, ExportVariant, IdTitle, QuestionStatus,
} from '../models/ai-assessment.model';

/** A library page: rows plus the trainer's AI usage (in `meta.usage`). */
export interface AiLibraryPage {
  rows: AiAssessmentRow[];
  total: number;
  usage: AiUsage | null;
}

interface RawLibrary {
  result: AiAssessmentRow[];
  meta?: { total?: number; usage?: AiUsage };
}

/**
 * Generation failures the page explains itself (with the server's translated
 * reason): the global interceptor would otherwise show a generic "server error"
 * for 502 / 503.
 */
const GENERATION_QUIET = [409, 422, 429, 502, 503] as const;

/** An action the server refused, with its translated reason and machine code. */
export class AiActionError extends Error {
  constructor(readonly reason: string | null, readonly code: string | null, readonly status: number) {
    super(reason ?? 'refused');
  }
}

@Injectable({ providedIn: 'root' })
export class AiAssessmentsApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly base = API.ADMIN_AI_ASSESSMENTS;

  library(filters: AiLibraryFilters): Observable<AiLibraryPage> {
    const params: Record<string, string | number> = { page: filters.page, per_page: filters.per_page };
    if (filters.search?.trim()) params['search'] = filters.search.trim();
    if (filters.type) params['type'] = filters.type;
    if (filters.content_language) params['content_language'] = filters.content_language;

    return this.api.getRaw<RawLibrary>(this.base, params).pipe(map(res => ({
      rows: res.result ?? [],
      total: res.meta?.total ?? 0,
      usage: res.meta?.usage ?? null,
    })));
  }

  usage(): Observable<AiUsage> {
    return this.api.get<AiUsage>(`${this.base}/usage`).pipe(map(r => r.result));
  }

  courses(search = ''): Observable<IdTitle[]> {
    return this.api.get<IdTitle[]>(`${this.base}/courses`, search ? { search } : undefined).pipe(map(r => r.result ?? []));
  }

  get(id: number): Observable<AiAssessment> {
    return this.api.get<AiAssessment>(`${this.base}/${id}`).pipe(map(r => r.result));
  }

  create(details: AiAssessmentDetails): Observable<AiAssessment> {
    return this.api.post<AiAssessment>(this.base, details).pipe(map(r => r.result));
  }

  update(id: number, changes: Partial<AiAssessmentDetails>): Observable<AiAssessment> {
    return this.api.put<AiAssessment>(`${this.base}/${id}`, changes).pipe(map(r => r.result));
  }

  remove(id: number): Observable<void> {
    return this.api.delete(`${this.base}/${id}`).pipe(map(() => undefined));
  }

  duplicate(id: number, asVersion: boolean): Observable<AiAssessment> {
    return this.api.post<AiAssessment>(`${this.base}/${id}/duplicate`, { as_version: asVersion }).pipe(map(r => r.result));
  }

  upload(id: number, file: File): Observable<AiSource> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<ApiResponse<AiSource>>(`${this.base}/${id}/sources`, body, {
      context: new HttpContext().set(QUIET_STATUSES, [422, 409]),
    }).pipe(map(r => r.result), catchError(err => throwError(() => toActionError(err))));
  }

  paste(id: number, text: string, label: string | null): Observable<AiSource> {
    return this.http.post<ApiResponse<AiSource>>(`${this.base}/${id}/sources/text`, { text, label }, {
      context: new HttpContext().set(QUIET_STATUSES, [422, 409]),
    }).pipe(map(r => r.result), catchError(err => throwError(() => toActionError(err))));
  }

  removeSource(id: number, sourceId: number): Observable<void> {
    return this.api.delete(`${this.base}/${id}/sources/${sourceId}`).pipe(map(() => undefined));
  }

  generate(id: number): Observable<{ assessment: AiAssessment; usage: AiUsage }> {
    return this.http.post<ApiResponse<{ assessment: AiAssessment; usage: AiUsage }>>(`${this.base}/${id}/generate`, {}, {
      context: new HttpContext().set(QUIET_STATUSES, [...GENERATION_QUIET]),
    }).pipe(map(r => r.result), catchError(err => throwError(() => toActionError(err))));
  }

  regenerate(id: number, questionId: number): Observable<{ question: AiQuestion; usage: AiUsage }> {
    return this.http.post<ApiResponse<{ question: AiQuestion; usage: AiUsage }>>(
      `${this.base}/${id}/questions/${questionId}/regenerate`, {},
      { context: new HttpContext().set(QUIET_STATUSES, [...GENERATION_QUIET]) },
    ).pipe(map(r => r.result), catchError(err => throwError(() => toActionError(err))));
  }

  updateQuestion(id: number, questionId: number, payload: AiQuestionPayload): Observable<AiQuestion> {
    return this.http.put<ApiResponse<AiQuestion>>(`${this.base}/${id}/questions/${questionId}`, payload, {
      context: new HttpContext().set(QUIET_STATUSES, [422, 409]),
    }).pipe(map(r => r.result), catchError(err => throwError(() => toActionError(err))));
  }

  setStatus(id: number, questionId: number, status: QuestionStatus): Observable<AiQuestion> {
    return this.api.patch<AiQuestion>(`${this.base}/${id}/questions/${questionId}/status`, { status }).pipe(map(r => r.result));
  }

  removeQuestion(id: number, questionId: number): Observable<void> {
    return this.api.delete(`${this.base}/${id}/questions/${questionId}`).pipe(map(() => undefined));
  }

  reorder(id: number, ids: number[]): Observable<void> {
    return this.api.put(`${this.base}/${id}/questions/order`, { ids }).pipe(map(() => undefined));
  }

  /** Fetch the export with the bearer token and hand it to the browser. */
  export(id: number, format: ExportFormat, variant: ExportVariant, fallbackName: string): Observable<void> {
    const params = new HttpParams().set('format', format).set('variant', variant);
    return this.http.get(`${this.base}/${id}/export`, {
      params, responseType: 'blob', observe: 'response', context: new HttpContext().set(QUIET_STATUSES, [422]),
    }).pipe(
      map((res: HttpResponse<Blob>) => {
        if (res.body) saveBlob(res.body, contentDispositionName(res.headers.get('Content-Disposition')) ?? `${fallbackName}.${format}`);
      }),
      catchError((err: unknown) => err instanceof HttpErrorResponse && err.error instanceof Blob
        ? from(err.error.text()).pipe(switchMap(text => throwError(() => toActionError(
          new HttpErrorResponse({ error: safeJson(text), status: err.status }),
        ))))
        : throwError(() => toActionError(err))),
    );
  }
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

/** The server's reason (`message`), its code (`errors.reason[0]`) or first field error. */
function toActionError(err: unknown): unknown {
  if (!(err instanceof HttpErrorResponse)) return err;
  const body = err.error as { message?: unknown; errors?: Record<string, unknown> } | null;
  const errors = body?.errors ?? {};
  const reasonList = errors['reason'];
  const code = Array.isArray(reasonList) && typeof reasonList[0] === 'string' ? reasonList[0] : null;
  let message = typeof body?.message === 'string' ? body.message : null;
  if (!code) {
    for (const list of Object.values(errors)) {
      if (Array.isArray(list) && typeof list[0] === 'string') { message = list[0]; break; }
    }
  }
  return new AiActionError(message, code, err.status);
}
