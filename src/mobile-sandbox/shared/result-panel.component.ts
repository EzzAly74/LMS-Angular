import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiCallResult } from '../core/mobile-api.service';

/**
 * Renders everything the spec requires for an API test: request payload,
 * response payload, response time, HTTP status, validation errors and
 * server errors — in a compact, copy-friendly panel.
 */
@Component({
  selector: 'sbx-result-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (result) {
      <div class="rp">
        <div class="rp__bar">
          <span class="rp__status" [class.rp__status--ok]="result.ok" [class.rp__status--err]="!result.ok">
            {{ result.status || 'ERR' }}
          </span>
          <span class="rp__method">{{ result.method }}</span>
          <span class="rp__url">{{ result.url }}</span>
          <span class="rp__time">{{ result.durationMs }} ms</span>
        </div>

        @if (result.message) {
          <p class="rp__message" [class.rp__message--err]="!result.ok">{{ result.message }}</p>
        }

        @if (result.validationErrors) {
          <div class="rp__section rp__section--warn">
            <h4>Validation errors</h4>
            <ul>
              @for (entry of validationList(); track entry.field) {
                <li><b>{{ entry.field }}</b>: {{ entry.messages.join(', ') }}</li>
              }
            </ul>
          </div>
        }

        <div class="rp__grid">
          <div class="rp__section">
            <h4>Request</h4>
            <pre>{{ result.request | json }}</pre>
          </div>
          <div class="rp__section">
            <h4>Response</h4>
            <pre>{{ display(result.response) }}</pre>
          </div>
        </div>

        @if (result.error) {
          <div class="rp__section rp__section--err">
            <h4>Server / transport error</h4>
            <pre>{{ result.error | json }}</pre>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .rp { border: 1px solid #e3e6ea; border-radius: 10px; overflow: hidden; background: #fff; }
      .rp__bar {
        display: flex; align-items: center; gap: 10px; padding: 10px 12px;
        background: #f7f8fa; border-bottom: 1px solid #e3e6ea; font-size: 13px; flex-wrap: wrap;
      }
      .rp__status { font-weight: 700; padding: 2px 8px; border-radius: 999px; color: #fff; }
      .rp__status--ok { background: #138a52; }
      .rp__status--err { background: #d23b30; }
      .rp__method { font-weight: 600; color: #0c2427; }
      .rp__url { color: #5b6470; word-break: break-all; flex: 1; min-width: 200px; }
      .rp__time { color: #8c8c8c; font-variant-numeric: tabular-nums; }
      .rp__message { margin: 0; padding: 8px 12px; font-size: 13px; color: #138a52; border-bottom: 1px solid #eef0f2; }
      .rp__message--err { color: #d23b30; }
      .rp__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
      @media (max-width: 900px) { .rp__grid { grid-template-columns: 1fr; } }
      .rp__section { padding: 10px 12px; border-top: 1px solid #eef0f2; }
      .rp__grid .rp__section:first-child { border-right: 1px solid #eef0f2; }
      .rp__section h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #8c8c8c; }
      .rp__section--warn { background: #fff8ec; }
      .rp__section--err { background: #fdeceb; }
      pre {
        margin: 0; max-height: 360px; overflow: auto; font-size: 12px; line-height: 1.5;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #2b2f36; white-space: pre-wrap; word-break: break-word;
      }
      ul { margin: 0; padding-left: 18px; font-size: 13px; color: #8a5a00; }
    `,
  ],
})
export class ResultPanelComponent {
  @Input() result: ApiCallResult | null = null;

  validationList(): { field: string; messages: string[] }[] {
    const v = this.result?.validationErrors ?? {};
    return Object.entries(v).map(([field, messages]) => ({ field, messages }));
  }

  /** Truncate huge base64 blobs (certificate download) so the panel stays usable. */
  display(response: unknown): string {
    let json = '';
    try {
      json = JSON.stringify(response, null, 2);
    } catch {
      return String(response);
    }
    if (json.length > 20000) {
      return json.slice(0, 20000) + `\n… (${json.length - 20000} more chars truncated)`;
    }
    return json;
  }
}
