import { Injectable, computed, signal } from '@angular/core';

/**
 * In-browser API call log for the mobile sandbox. Every request the
 * MobileApiService fires is appended here with its request/response,
 * status, duration and any error so the operator can audit the full
 * learner journey and export it as JSON.
 *
 * (The spec's `mobile-sandbox/logs` folder holds the exported artifacts;
 * the live log lives here in memory + localStorage so it survives reloads.)
 */
export interface ApiLogEntry {
  id: string;
  timestamp: string;
  name: string;
  method: string;
  url: string;
  status: number;
  ok: boolean;
  durationMs: number;
  request: unknown;
  response: unknown;
  error: unknown;
}

const STORAGE_KEY = 'mobile_sandbox_logs_v1';
const MAX_ENTRIES = 200;

@Injectable({ providedIn: 'root' })
export class MobileLogService {
  private readonly _entries = signal<ApiLogEntry[]>(this.read());

  readonly entries = this._entries.asReadonly();
  readonly count = computed(() => this._entries().length);
  readonly failures = computed(() => this._entries().filter((e) => !e.ok).length);

  add(entry: Omit<ApiLogEntry, 'id' | 'timestamp'>): void {
    const full: ApiLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    const next = [full, ...this._entries()].slice(0, MAX_ENTRIES);
    this._entries.set(next);
    this.write(next);
  }

  clear(): void {
    this._entries.set([]);
    this.write([]);
  }

  /** Serialize the full log to a pretty JSON string for download. */
  toJson(): string {
    return JSON.stringify(this._entries(), null, 2);
  }

  private read(): ApiLogEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ApiLogEntry[];
    } catch {
      /* ignore */
    }
    return [];
  }

  private write(entries: ApiLogEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* ignore quota errors */
    }
  }
}
