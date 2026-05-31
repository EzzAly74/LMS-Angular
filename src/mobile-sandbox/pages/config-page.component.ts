import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SandboxConfigService } from '../core/sandbox-config.service';
import { MobileApiService } from '../core/mobile-api.service';
import { ResultPanelComponent } from '../shared/result-panel.component';
import { ApiCallResult } from '../core/mobile-api.service';
import { endpointById } from '../core/endpoints';

/** Connection ("login") page: persist the S2S token + employee code. */
@Component({
  selector: 'sbx-config-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ResultPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cfg">
      <h2>Connection</h2>
      <p class="cfg__lead">
        The mobile contract is server-to-server: a shared bearer token plus an
        <code>Employee-Code</code> header that identifies the acting learner. Save them
        here once — every preview screen and tester reuses them through an isolated
        HTTP client that bypasses the app interceptors.
      </p>

      <label class="cfg__field">
        <span>API base URL</span>
        <input type="text" [(ngModel)]="baseUrl" placeholder="http://127.0.0.1:8000/api/v1" />
      </label>

      <label class="cfg__field">
        <span>Shared mobile token</span>
        <input type="text" [(ngModel)]="token" placeholder="paste the shared mobile token" />
      </label>

      <div class="cfg__grid">
        <label class="cfg__field">
          <span>Employee code</span>
          <input type="text" [(ngModel)]="employeeCode" placeholder="e.g. 2394" />
        </label>
        <label class="cfg__field">
          <span>Locale</span>
          <select [(ngModel)]="locale">
            <option value="en">en</option>
            <option value="ar">ar</option>
          </select>
        </label>
      </div>

      <div class="cfg__actions">
        <button class="btn btn--primary" type="button" (click)="save()">Save</button>
        <button class="btn" type="button" [disabled]="testing()" (click)="test()">
          {{ testing() ? 'Testing…' : 'Save & test /mobile/me' }}
        </button>
        <button class="btn btn--ghost" type="button" (click)="disconnect()">Disconnect</button>
        @if (saved()) { <span class="cfg__ok">Saved ✓</span> }
      </div>

      @if (result()) {
        <h3 class="cfg__rh">Connection test</h3>
        <sbx-result-panel [result]="result()" />
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .cfg { max-width: 640px; }
      h2 { margin: 0 0 6px; font-size: 20px; color: #1f2329; }
      .cfg__lead { color: #5b6470; font-size: 13px; line-height: 1.6; margin: 0 0 18px; }
      code { background: #eef1f3; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
      .cfg__field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
      .cfg__field > span { font-size: 12px; font-weight: 600; color: #404750; }
      .cfg__field input, .cfg__field select { height: 40px; border: 1px solid #cfd4d9; border-radius: 8px; padding: 0 12px; font-family: inherit; font-size: 13px; color: #1f2329; }
      .cfg__grid { display: grid; grid-template-columns: 1fr 140px; gap: 14px; }
      .cfg__actions { display: flex; align-items: center; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
      .btn { height: 38px; padding: 0 16px; border-radius: 8px; border: 1px solid #cfd4d9; background: #fff; font-family: inherit; font-size: 13px; font-weight: 600; color: #1f2329; cursor: pointer; }
      .btn--primary { background: #0c2427; color: #fff; border-color: #0c2427; }
      .btn--ghost { color: #c0392b; border-color: #f0c8c2; }
      .cfg__ok { color: #138a52; font-size: 13px; font-weight: 600; }
      .cfg__rh { margin: 22px 0 10px; font-size: 15px; color: #1f2329; }
    `,
  ],
})
export class ConfigPageComponent {
  private readonly cfg = inject(SandboxConfigService);
  private readonly api = inject(MobileApiService);

  baseUrl = this.cfg.config().baseUrl;
  token = this.cfg.config().token;
  employeeCode = this.cfg.config().employeeCode;
  locale = this.cfg.config().locale;

  readonly testing = signal(false);
  readonly saved = signal(false);
  readonly result = signal<ApiCallResult | null>(null);

  save(): void {
    this.cfg.update({
      baseUrl: this.baseUrl.trim(),
      token: this.token.trim(),
      employeeCode: this.employeeCode.trim(),
      locale: this.locale as 'en' | 'ar',
    });
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 1800);
  }

  async test(): Promise<void> {
    this.save();
    this.testing.set(true);
    try {
      const def = endpointById('me')!;
      this.result.set(await this.api.call(def, {}));
    } finally {
      this.testing.set(false);
    }
  }

  disconnect(): void {
    this.cfg.disconnect();
    this.token = '';
    this.employeeCode = '';
    this.result.set(null);
  }
}
