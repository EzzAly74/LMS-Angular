import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { EndpointDef, endpointById } from '../core/endpoints';
import { MobileApiService, ApiCallResult, CallInputs } from '../core/mobile-api.service';
import { ResultPanelComponent } from '../shared/result-panel.component';

/**
 * Generic, catalog-driven tester for a single endpoint (`/e/:id`).
 * Builds an input form from the endpoint's declared params, fires the
 * isolated client, and renders request/response/status/time/errors.
 */
@Component({
  selector: 'sbx-endpoint-tester',
  standalone: true,
  imports: [CommonModule, FormsModule, ResultPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (def(); as d) {
      <div class="et">
        <header class="et__head">
          <span class="et__verb" [attr.data-m]="d.method">{{ d.method }}</span>
          <div>
            <h2>{{ d.label }}</h2>
            <code class="et__path">{{ d.path }}</code>
          </div>
        </header>

        <div class="et__chips">
          @for (f of d.features; track f) { <span class="chip">{{ f }}</span> }
          @if (d.manualOnly) { <span class="chip chip--warn">mutating / manual</span> }
        </div>

        @if (d.notes) { <p class="et__notes">{{ d.notes }}</p> }

        @if (d.params.length) {
          <div class="et__form">
            @for (p of d.params; track p.name) {
              <label class="et__field">
                <span>{{ p.name }} <em>({{ p.in }}{{ p.required ? ', required' : '' }})</em></span>
                <input
                  [type]="p.type === 'number' ? 'number' : 'text'"
                  [(ngModel)]="inputs[p.name]"
                  [placeholder]="p.help || ''" />
              </label>
            }
          </div>
        } @else {
          <p class="et__notes">No parameters — sends with the shared token + employee code only.</p>
        }

        <button class="btn btn--primary" type="button" [disabled]="running()" (click)="run(d)">
          {{ running() ? 'Sending…' : 'Send request' }}
        </button>

        @if (result()) {
          <h3 class="et__rh">Response</h3>
          <sbx-result-panel [result]="result()" />
        }
      </div>
    } @else {
      <div class="et__missing">Unknown endpoint.</div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .et__head { display: flex; gap: 12px; align-items: flex-start; }
      .et__verb { font-size: 11px; font-weight: 700; border-radius: 5px; padding: 3px 8px; background: #e6f4f1; color: #0c6157; margin-top: 4px; }
      .et__verb[data-m='POST'] { background: #fdebd0; color: #9c5700; }
      h2 { margin: 0; font-size: 19px; color: #1f2329; }
      .et__path { font-size: 12px; color: #8c8c8c; }
      .et__chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
      .chip { font-size: 11px; background: #eef1f3; color: #5b6470; padding: 3px 9px; border-radius: 999px; }
      .chip--warn { background: #fdebd0; color: #9c5700; }
      .et__notes { font-size: 13px; color: #5b6470; line-height: 1.5; background: #f7f8f9; padding: 10px 12px; border-radius: 8px; }
      .et__form { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 14px 0; }
      .et__field { display: flex; flex-direction: column; gap: 5px; }
      .et__field > span { font-size: 12px; font-weight: 600; color: #404750; }
      .et__field em { color: #9aa0a6; font-style: normal; font-weight: 400; }
      .et__field input { height: 38px; border: 1px solid #cfd4d9; border-radius: 8px; padding: 0 11px; font-family: inherit; font-size: 13px; }
      .btn { height: 40px; padding: 0 18px; border-radius: 8px; border: 1px solid #cfd4d9; background: #fff; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
      .btn--primary { background: #0c2427; color: #fff; border-color: #0c2427; }
      .et__rh { margin: 22px 0 10px; font-size: 15px; color: #1f2329; }
      .et__missing { padding: 30px; text-align: center; color: #8c8c8c; }
    `,
  ],
})
export class EndpointTesterComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(MobileApiService);
  private sub?: Subscription;

  readonly def = signal<EndpointDef | undefined>(undefined);
  readonly running = signal(false);
  readonly result = signal<ApiCallResult | null>(null);
  inputs: CallInputs = {};

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((pm) => {
      const d = endpointById(pm.get('id') ?? '');
      this.def.set(d);
      this.result.set(null);
      this.inputs = {};
      for (const p of d?.params ?? []) {
        if (p.default !== undefined) this.inputs[p.name] = p.default;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async run(d: EndpointDef): Promise<void> {
    this.running.set(true);
    try {
      this.result.set(await this.api.call(d, this.inputs));
    } finally {
      this.running.set(false);
    }
  }
}
