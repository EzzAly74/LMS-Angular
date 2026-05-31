import { Injectable, computed, signal } from '@angular/core';

/**
 * Holds the S2S connection settings the mobile sandbox uses for every
 * request. The real mobile contract is server-to-server (a shared bearer
 * token + an Employee-Code header that identifies the acting learner) —
 * there is no per-user login — so "logging in" here just means persisting
 * a valid token + employee code.
 *
 * Everything is kept in localStorage under a sandbox-only namespace so the
 * whole module stays self-contained and deletable.
 */
export interface SandboxConfig {
  baseUrl: string;
  token: string;
  employeeCode: string;
  locale: 'en' | 'ar';
}

const STORAGE_KEY = 'mobile_sandbox_config_v1';

const DEFAULTS: SandboxConfig = {
  baseUrl: 'http://127.0.0.1:8000/api/v1',
  token: '',
  employeeCode: '',
  locale: 'en',
};

@Injectable({ providedIn: 'root' })
export class SandboxConfigService {
  private readonly _config = signal<SandboxConfig>(this.read());

  readonly config = this._config.asReadonly();

  /** "Logged in" = we have both a token and an employee code to act as. */
  readonly connected = computed(
    () => !!this._config().token && !!this._config().employeeCode,
  );

  update(patch: Partial<SandboxConfig>): void {
    const next = { ...this._config(), ...patch };
    this._config.set(next);
    this.write(next);
  }

  /** Clears the acting identity — the sandbox "logout". */
  disconnect(): void {
    this.update({ token: '', employeeCode: '' });
  }

  private read(): SandboxConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* fall through to defaults */
    }
    return { ...DEFAULTS };
  }

  private write(cfg: SandboxConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      /* storage may be unavailable — non-fatal for a test tool */
    }
  }
}
