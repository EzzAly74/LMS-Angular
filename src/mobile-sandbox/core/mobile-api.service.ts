import { Injectable, inject } from '@angular/core';
import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
  HttpResponse,
} from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SandboxConfigService } from './sandbox-config.service';
import { MobileLogService } from './mobile-log.service';
import { EndpointDef, HttpMethod } from './endpoints';

/** Rich result captured for the result panel + journey runner. */
export interface ApiCallResult {
  name: string;
  method: string;
  url: string;
  request: { headers: Record<string, string>; query: Record<string, string>; body: unknown };
  status: number;
  ok: boolean;
  durationMs: number;
  response: unknown;
  /** Validation errors map (Laravel 422 `errors`), when present. */
  validationErrors: Record<string, string[]> | null;
  /** Top-level server message, when present. */
  message: string | null;
  error: unknown;
}

/** Dynamic inputs the tester collects, keyed by param name. */
export type CallInputs = Record<string, string | number | null | undefined>;

/**
 * Isolated HTTP client for the mobile sandbox.
 *
 * It is built from `HttpBackend` (NOT the app `HttpClient`), so it bypasses
 * the global auth/locale/error interceptors entirely. That is essential:
 * the app auth interceptor would otherwise overwrite our shared mobile
 * bearer token with the logged-in admin's token, and the locale interceptor
 * would override the Accept-Language we want to test. Everything here is
 * self-contained and leaves the production HTTP stack untouched.
 */
@Injectable({ providedIn: 'root' })
export class MobileApiService {
  private readonly config = inject(SandboxConfigService);
  private readonly log = inject(MobileLogService);
  private readonly http = new HttpClient(inject(HttpBackend));

  /** Build the absolute URL for an endpoint, substituting `{path}` params. */
  buildUrl(def: EndpointDef, inputs: CallInputs): string {
    const base = this.config.config().baseUrl.replace(/\/+$/, '');
    let path = def.path;
    for (const p of def.params.filter((x) => x.in === 'path')) {
      const value = inputs[p.name];
      path = path.replace(
        `{${p.name}}`,
        encodeURIComponent(String(value ?? '')),
      );
    }
    return `${base}${path}`;
  }

  /** Execute one endpoint with the operator-supplied inputs. */
  async call(def: EndpointDef, inputs: CallInputs): Promise<ApiCallResult> {
    const cfg = this.config.config();
    const url = this.buildUrl(def, inputs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': cfg.locale,
      Authorization: `Bearer ${cfg.token}`,
      'Employee-Code': cfg.employeeCode,
    };

    const query: Record<string, string> = {};
    let params = new HttpParams();
    for (const p of def.params.filter((x) => x.in === 'query')) {
      const value = inputs[p.name];
      if (value !== null && value !== undefined && value !== '') {
        query[p.name] = String(value);
        params = params.set(p.name, String(value));
      }
    }

    const body: Record<string, unknown> = {};
    for (const p of def.params.filter((x) => x.in === 'body')) {
      const value = inputs[p.name];
      if (value !== null && value !== undefined && value !== '') {
        body[p.name] = p.type === 'number' ? Number(value) : value;
      }
    }

    const started = performance.now();
    const result = await this.send(
      def.method,
      url,
      new HttpHeaders(headers),
      params,
      def.method === 'POST' ? body : undefined,
    );

    const durationMs = Math.round(performance.now() - started);
    const full: ApiCallResult = {
      name: def.label,
      method: def.method,
      url,
      request: { headers: this.redact(headers), query, body },
      durationMs,
      ...result,
    };

    this.log.add({
      name: full.name,
      method: full.method,
      url: full.url,
      status: full.status,
      ok: full.ok,
      durationMs: full.durationMs,
      request: full.request,
      response: full.response,
      error: full.error,
    });

    return full;
  }

  private async send(
    method: HttpMethod,
    url: string,
    headers: HttpHeaders,
    params: HttpParams,
    body: unknown,
  ): Promise<Omit<ApiCallResult, 'name' | 'method' | 'url' | 'request' | 'durationMs'>> {
    try {
      const res = await firstValueFrom(
        method === 'GET'
          ? this.http.get(url, { headers, params, observe: 'response' })
          : this.http.post(url, body ?? {}, { headers, params, observe: 'response' }),
      );
      const r = res as HttpResponse<unknown>;
      return {
        status: r.status,
        ok: true,
        response: r.body,
        validationErrors: null,
        message: this.pickMessage(r.body),
        error: null,
      };
    } catch (e) {
      const err = e as HttpErrorResponse;
      const errBody = err.error;
      return {
        status: err.status ?? 0,
        ok: false,
        response: errBody ?? null,
        validationErrors: this.pickValidation(errBody),
        message: this.pickMessage(errBody) ?? err.message ?? null,
        error: { name: err.name, statusText: err.statusText },
      };
    }
  }

  private pickMessage(body: unknown): string | null {
    if (body && typeof body === 'object' && 'message' in body) {
      const m = (body as { message?: unknown }).message;
      return typeof m === 'string' ? m : null;
    }
    return null;
  }

  private pickValidation(body: unknown): Record<string, string[]> | null {
    if (body && typeof body === 'object' && 'errors' in body) {
      const e = (body as { errors?: unknown }).errors;
      if (e && typeof e === 'object') return e as Record<string, string[]>;
    }
    return null;
  }

  /** Mask the bearer token in the rendered request so the panel is shareable. */
  private redact(headers: Record<string, string>): Record<string, string> {
    const copy = { ...headers };
    if (copy['Authorization']) {
      const tok = copy['Authorization'].replace('Bearer ', '');
      copy['Authorization'] = `Bearer ${tok.slice(0, 6)}…${tok.slice(-4)}`;
    }
    return copy;
  }
}
