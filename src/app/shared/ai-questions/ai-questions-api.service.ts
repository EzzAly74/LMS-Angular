import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { API } from '../../core/constants/api.constants';
import { QUIET_STATUSES } from '../../core/interceptors/error.interceptor';
import type { ApiResponse } from '../../core/models/api-response.model';
import type { AiGenerateSettings, AiGeneration, AiTarget, AiUsage } from './ai-questions.model';

/** A start the server refused, with its translated reason. */
export class AiRefusal extends Error {
  constructor(readonly reason: string | null, readonly status: number) {
    super(reason ?? 'refused');
  }
}

/**
 * The dialog shows these itself with the server's (translated) reason; the
 * global interceptor would otherwise turn 503 into a generic "server error".
 */
const QUIET = [409, 422, 429, 503] as const;

@Injectable({ providedIn: 'root' })
export class AiQuestionsApiService {
  private readonly http = inject(HttpClient);

  private base(target: AiTarget): string {
    return `${target === 'quiz' ? API.ADMIN_QUIZZES : API.ADMIN_ASSIGNMENTS}/ai-generations`;
  }

  usage(target: AiTarget): Observable<AiUsage> {
    return this.http.get<ApiResponse<AiUsage>>(`${this.base(target)}/usage`).pipe(map(r => r.result));
  }

  start(target: AiTarget, settings: AiGenerateSettings, files: readonly File[], text: string): Observable<{ generation: AiGeneration; usage: AiUsage }> {
    const body = new FormData();
    files.forEach(f => body.append('files[]', f, f.name));
    if (text.trim()) body.append('text', text);
    for (const [type, n] of Object.entries(settings.counts)) body.append(`counts[${type}]`, String(n ?? 0));
    body.append('difficulty', settings.difficulty);
    settings.bloom_levels.forEach(b => body.append('bloom_levels[]', b));
    if (settings.objectives) body.append('objectives', settings.objectives);
    body.append('score', String(settings.score));
    if (settings.course_id) body.append('course_id', String(settings.course_id));
    if (settings.assessment_type) body.append('assessment_type', settings.assessment_type);

    return this.http.post<ApiResponse<{ generation: AiGeneration; usage: AiUsage }>>(this.base(target), body, {
      context: new HttpContext().set(QUIET_STATUSES, [...QUIET]),
    }).pipe(map(r => r.result), catchError(err => throwError(() => refusal(err))));
  }

  get(target: AiTarget, id: number): Observable<AiGeneration> {
    return this.http.get<ApiResponse<AiGeneration>>(`${this.base(target)}/${id}`).pipe(map(r => r.result));
  }
}

/** The server's first field error, else its message. */
function refusal(err: unknown): unknown {
  if (!(err instanceof HttpErrorResponse)) return err;
  const body = err.error as { message?: unknown; errors?: Record<string, unknown> } | null;
  let reason = typeof body?.message === 'string' ? body.message : null;
  for (const [key, list] of Object.entries(body?.errors ?? {})) {
    if (key !== 'reason' && Array.isArray(list) && typeof list[0] === 'string') { reason = list[0]; break; }
  }
  return new AiRefusal(reason, err.status);
}
