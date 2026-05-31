import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ENDPOINTS, EndpointDef } from '../core/endpoints';
import { MobileApiService, CallInputs } from '../core/mobile-api.service';
import { SandboxConfigService } from '../core/sandbox-config.service';

interface RunRow {
  def: EndpointDef;
  state: 'pending' | 'running' | 'pass' | 'fail' | 'skipped';
  status?: number;
  durationMs?: number;
  message?: string | null;
}

/** Runs the full read-only learner journey top-to-bottom and reports pass/fail. */
@Component({
  selector: 'sbx-journey-page',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jr">
      <header class="jr__head">
        <div>
          <h2>Run journey</h2>
          <small>Executes every non-mutating endpoint in order. Mutating calls (enrol, mark, rate, download) are skipped — use the phone preview or per-endpoint testers.</small>
        </div>
        <button class="btn btn--primary" type="button" [disabled]="running() || !connected()" (click)="run()">
          {{ running() ? 'Running…' : 'Run all' }}
        </button>
      </header>

      @if (!connected()) {
        <div class="jr__warn">Not connected — set the token + employee code first.</div>
      }

      @if (done()) {
        <div class="jr__summary">
          <span class="pass">{{ passed() }} passed</span>
          <span class="fail">{{ failed() }} failed</span>
          <span class="skip">{{ skipped() }} skipped</span>
        </div>
      }

      <div class="jr__list">
        @for (r of rows(); track r.def.id) {
          <div class="row" [attr.data-s]="r.state">
            <span class="row__step">{{ r.def.step }}</span>
            <span class="row__icon">{{ icon(r.state) }}</span>
            <div class="row__main">
              <div class="row__label">{{ r.def.label }}</div>
              <code>{{ r.def.method }} {{ r.def.path }}</code>
            </div>
            <span class="row__meta">
              @if (r.status) { <b>{{ r.status }}</b> }
              @if (r.durationMs != null) { · {{ r.durationMs }} ms }
            </span>
          </div>
          @if (r.message && r.state === 'fail') { <div class="row__err">{{ r.message }}</div> }
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .jr__head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
      h2 { margin: 0; font-size: 20px; color: #1f2329; }
      small { color: #8c8c8c; font-size: 12px; display: block; max-width: 560px; line-height: 1.5; }
      .btn { height: 38px; padding: 0 18px; border-radius: 8px; border: 1px solid #cfd4d9; background: #fff; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
      .btn--primary { background: #0c2427; color: #fff; border-color: #0c2427; }
      .btn:disabled { opacity: .5; cursor: not-allowed; }
      .jr__warn { background: #fff6e5; border: 1px solid #f3d488; color: #8a5a00; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 13px; }
      .jr__summary { display: flex; gap: 14px; margin-bottom: 12px; font-size: 13px; font-weight: 600; }
      .pass { color: #138a52; } .fail { color: #c0392b; } .skip { color: #8c8c8c; }
      .jr__list { border: 1px solid #e3e6ea; border-radius: 10px; overflow: hidden; background: #fff; }
      .row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid #f0f2f4; }
      .row__step { width: 22px; height: 22px; border-radius: 50%; background: #eef1f3; color: #5b6470; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
      .row__icon { width: 18px; text-align: center; }
      .row__main { flex: 1; min-width: 0; }
      .row__label { font-size: 13px; color: #1f2329; font-weight: 600; }
      .row__main code { font-size: 11px; color: #8c8c8c; }
      .row__meta { font-size: 12px; color: #8c8c8c; }
      .row[data-s='pass'] { background: #f5fbf7; }
      .row[data-s='fail'] { background: #fdf3f2; }
      .row__err { padding: 8px 14px 12px 48px; color: #c0392b; font-size: 12px; background: #fdf3f2; }
    `,
  ],
})
export class JourneyPageComponent {
  private readonly api = inject(MobileApiService);
  private readonly cfg = inject(SandboxConfigService);

  readonly connected = this.cfg.connected;
  readonly running = signal(false);
  readonly done = signal(false);
  readonly rows = signal<RunRow[]>(ENDPOINTS.map((def) => ({ def, state: def.manualOnly ? 'skipped' : 'pending' })));

  passed = () => this.rows().filter((r) => r.state === 'pass').length;
  failed = () => this.rows().filter((r) => r.state === 'fail').length;
  skipped = () => this.rows().filter((r) => r.state === 'skipped').length;

  icon(s: RunRow['state']): string {
    return { pending: '·', running: '⏳', pass: '✓', fail: '✗', skipped: '–' }[s];
  }

  async run(): Promise<void> {
    this.running.set(true);
    this.done.set(false);
    this.rows.set(ENDPOINTS.map((def) => ({ def, state: def.manualOnly ? 'skipped' : 'pending' })));

    for (let i = 0; i < this.rows().length; i++) {
      const row = this.rows()[i];
      if (row.def.manualOnly) continue;
      this.patch(i, { state: 'running' });
      const inputs: CallInputs = {};
      for (const p of row.def.params) if (p.default !== undefined) inputs[p.name] = p.default;
      const res = await this.api.call(row.def, inputs);
      this.patch(i, {
        state: res.ok ? 'pass' : 'fail',
        status: res.status,
        durationMs: res.durationMs,
        message: res.message,
      });
    }

    this.running.set(false);
    this.done.set(true);
  }

  private patch(i: number, patch: Partial<RunRow>): void {
    const next = [...this.rows()];
    next[i] = { ...next[i], ...patch };
    this.rows.set(next);
  }
}
