import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { Router } from '@angular/router';
import { API } from '../constants/api.constants';
import { ApiResponse } from '../models/api-response.model';
import type { AuthAdmin } from '../models/auth.types';

const TOKEN_KEY = '2b_token';

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

  /** Validate stored token and refresh admin profile (call on app bootstrap). */
  bootstrapSession(): Observable<AuthAdmin | null> {
    if (!this._token()) return of(null);
    return this.http.get<ApiResponse<AuthAdmin>>(API.AUTH.ME).pipe(
      map(res => res.result ?? null),
      tap(admin => {
        if (admin) this._admin.set(admin);
        else this.clearSession();
      }),
      catchError(() => {
        this.clearSession();
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

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._token.set(null);
    this._admin.set(null);
  }
}
