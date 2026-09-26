import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, of, map, retry, throwError, timer } from 'rxjs';
import { Router } from '@angular/router';
import { API } from '../constants/api.constants';
import { ApiResponse } from '../models/api-response.model';
import type { AuthAdmin } from '../models/auth.types';

const TOKEN_KEY = '2b_token';

/** The server rejected the token: the session is over. */
function isRejected(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403);
}

/** Offline, rate-limited or a server fault: says nothing about the token. */
function isTransient(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 0 || err.status === 429 || err.status >= 500);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _admin = signal<AuthAdmin | null>(null);

  readonly token           = this._token.asReadonly();
  readonly currentAdmin    = this._admin.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());

  /**
   * Distinct `view-*` permission keys the current admin holds.
   * Sourced from the backend on login / `/me` refresh, materialised
   * as a Set for O(1) lookups by the sidebar and route guard.
   */
  readonly viewKeys = computed<ReadonlySet<string>>(() => {
    const admin = this._admin();
    return new Set(admin?.view_keys ?? []);
  });

  /** True when the current admin holds the legacy `superAdmin` role. */
  readonly isSuperAdmin = computed(() => !!this._admin()?.is_super_admin);

  /**
   * True when the current admin can access a permission-gated section.
   *   - Super admins pass every check.
   *   - Unprotected sections (`key` empty / null) are open to anyone
   *     who has reached the layout.
   *   - Otherwise the key must appear in `view_keys`.
   *
   * Synchronous & signal-safe — call freely from templates and guards.
   */
  hasView(key: string | null | undefined): boolean {
    if (!key) return true;
    if (this.isSuperAdmin()) return true;
    return this.viewKeys().has(key);
  }

  login(email: string, password: string): Observable<ApiResponse<{ token: string; admin: AuthAdmin }>> {
    return this.http
      .post<ApiResponse<{ token: string; admin: AuthAdmin }>>(API.AUTH.LOGIN, { email, password })
      .pipe(tap(res => {
        const token = res?.result?.token;
        const admin = res?.result?.admin;
        if (token) this.storeSession(token);
        if (admin) this._admin.set(admin);
      }));
  }

  /**
   * Validate the stored token and load the admin profile (app bootstrap).
   *
   * AUTH-01: this used to clear the session on ANY error, so a dropped
   * connection, a 5xx or a 429 during startup deleted a perfectly valid token
   * and logged the admin out. Now:
   *   - 401/403 (the token was rejected)  -> the session ends, as before.
   *   - offline / 429 / 5xx               -> retried twice with backoff; if it
   *     still fails, the session is suspended in memory only. The guards then
   *     show the login page (keeping the token signal would loop: authGuard
   *     passes, the permission guard finds no view keys and falls back to
   *     login, guestGuard sends it back), but the stored token survives, so
   *     the next load restores the session instead of forcing a new login.
   */
  bootstrapSession(): Observable<AuthAdmin | null> {
    if (!this._token()) return of(null);
    return this.http.get<ApiResponse<AuthAdmin>>(API.AUTH.ME).pipe(
      retry({
        count: 2,
        delay: (err: unknown, attempt: number) =>
          isTransient(err) ? timer(400 * attempt) : throwError(() => err),
      }),
      map(res => res.result ?? null),
      tap(admin => {
        if (admin) this._admin.set(admin);
        else this.clearSession();
      }),
      catchError((err: unknown) => {
        if (isRejected(err)) this.clearSession();
        else this.suspendSession();
        return of(null);
      }),
    );
  }

  logout(): void {
    this.http.post(API.AUTH.LOGOUT, {}).subscribe({ error: () => {} });
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }

  private storeSession(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
  }

  /** Forget the session for this page load without deleting the stored token. */
  private suspendSession(): void {
    this._token.set(null);
    this._admin.set(null);
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._token.set(null);
    this._admin.set(null);
  }
}
