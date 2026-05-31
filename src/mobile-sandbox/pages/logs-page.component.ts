import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MobileLogService, ApiLogEntry } from '../core/mobile-log.service';

/** Chronological log of every sandbox API call, with JSON export. */
@Component({
  selector: 'sbx-logs-page',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lg">
      <header class="lg__head">
        <div>
          <h2>Logs</h2>
          <small>{{ log.count() }} calls · {{ log.failures() }} failed</small>
        </div>
        <div class="lg__actions">
          <button class="btn" type="button" (click)="download()">Export JSON</button>
          <button class="btn btn--ghost" type="button" (click)="log.clear()">Clear</button>
        </div>
      </header>

      @if (log.entries().length === 0) {
        <div class="lg__empty">No calls logged yet.</div>
      } @else {
        <div class="lg__list">
          @for (e of log.entries(); track e.id) {
            <div class="row" [class.row--err]="!e.ok" (click)="toggle(e.id)">
              <span class="row__status" [class.ok]="e.ok">{{ e.status || 'ERR' }}</span>
              <span class="row__method">{{ e.method }}</span>
              <span class="row__name">{{ e.name }}</span>
              <span class="row__time">{{ e.durationMs }} ms</span>
              <span class="row__ts">{{ e.timestamp | date: 'HH:mm:ss' }}</span>
            </div>
            @if (open() === e.id) {
              <pre class="row__detail">{{ pretty(e) }}</pre>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .lg__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      h2 { margin: 0; font-size: 20px; color: #1f2329; }
      small { color: #8c8c8c; font-size: 12px; }
      .lg__actions { display: flex; gap: 8px; }
      .btn { height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #cfd4d9; background: #fff; font-family: inherit; font-size: 13px; font-weight: 600; color: #1f2329; cursor: pointer; }
      .btn--ghost { color: #c0392b; border-color: #f0c8c2; }
      .lg__empty { padding: 30px; text-align: center; color: #8c8c8c; background: #f7f8f9; border-radius: 10px; }
      .lg__list { border: 1px solid #e3e6ea; border-radius: 10px; overflow: hidden; background: #fff; }
      .row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #f0f2f4; font-size: 13px; cursor: pointer; }
      .row:hover { background: #f7f9fa; }
      .row--err { background: #fdf3f2; }
      .row__status { min-width: 38px; text-align: center; font-weight: 700; font-size: 11px; padding: 2px 0; border-radius: 5px; background: #fbe3e1; color: #c0392b; }
      .row__status.ok { background: #e3f6ec; color: #138a52; }
      .row__method { font-weight: 700; font-size: 11px; color: #5b6470; min-width: 38px; }
      .row__name { flex: 1; color: #1f2329; }
      .row__time { color: #8c8c8c; }
      .row__ts { color: #b0b6bc; font-variant-numeric: tabular-nums; }
      .row__detail { margin: 0; padding: 12px 14px; background: #0f1c1e; color: #c8e7ec; font-size: 12px; overflow: auto; max-height: 320px; }
    `,
  ],
})
export class LogsPageComponent {
  readonly log = inject(MobileLogService);
  readonly open = signal<string | null>(null);

  toggle(id: string): void {
    this.open.set(this.open() === id ? null : id);
  }

  pretty(e: ApiLogEntry): string {
    return JSON.stringify({ request: e.request, response: e.response, error: e.error }, null, 2);
  }

  download(): void {
    const blob = new Blob([this.log.toJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mobile-sandbox-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
