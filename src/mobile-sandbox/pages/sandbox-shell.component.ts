import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SandboxConfigService } from '../core/sandbox-config.service';
import { MobileLogService } from '../core/mobile-log.service';
import { ENDPOINTS } from '../core/endpoints';

interface NavGroup {
  journey: string;
  items: { id: string; label: string; method: string }[];
}

/**
 * Isolated shell for the mobile sandbox (`/test-mobile`). Provides the
 * left nav (grouped by learner-journey step), a connection status bar,
 * and the router outlet. Self-contained styling — does not rely on the
 * production theme so the folder can be deleted cleanly.
 */
@Component({
  selector: 'sbx-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sbx">
      <aside class="sbx__nav">
        <div class="sbx__brand">
          <span class="sbx__logo">📱</span>
          <div>
            <strong>Mobile Sandbox</strong>
            <small>API validation harness</small>
          </div>
        </div>

        <a class="sbx__link" routerLink="preview" routerLinkActive="sbx__link--active">📱 Mobile preview</a>
        <a class="sbx__link" routerLink="config" routerLinkActive="sbx__link--active">⚙️ Connection</a>
        <a class="sbx__link" routerLink="journey" routerLinkActive="sbx__link--active">▶️ Run journey</a>
        <a class="sbx__link" routerLink="logs" routerLinkActive="sbx__link--active">
          🧾 Logs <span class="sbx__badge">{{ logCount() }}</span>
        </a>

        @for (group of groups(); track group.journey) {
          <div class="sbx__group">{{ group.journey }}</div>
          @for (item of group.items; track item.id) {
            <a class="sbx__link sbx__link--ep" [routerLink]="['e', item.id]" routerLinkActive="sbx__link--active">
              <span class="sbx__verb" [attr.data-m]="item.method">{{ item.method }}</span>
              {{ item.label }}
            </a>
          }
        }
      </aside>

      <main class="sbx__main">
        <header class="sbx__bar">
          <span class="sbx__dot" [class.sbx__dot--on]="connected()"></span>
          <span class="sbx__conn">
            {{ connected() ? 'Connected as employee ' + employeeCode() : 'Not connected — set token + employee code' }}
          </span>
          <span class="sbx__locale">locale: {{ locale() }}</span>
          <span class="sbx__base">{{ baseUrl() }}</span>
        </header>
        <div class="sbx__content">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100vh; }
      .sbx { display: grid; grid-template-columns: 290px 1fr; height: 100vh; font-family: 'Fira Sans', system-ui, sans-serif; color: #1f2329; }
      .sbx__nav { background: #0c2427; color: #cdd6da; overflow-y: auto; padding: 14px 10px; }
      .sbx__brand { display: flex; gap: 10px; align-items: center; padding: 6px 8px 14px; }
      .sbx__logo { font-size: 22px; }
      .sbx__brand strong { display: block; color: #fff; font-size: 15px; }
      .sbx__brand small { color: #7fa6ab; font-size: 11px; }
      .sbx__link {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin: 2px 0; border-radius: 8px;
        color: #cdd6da; text-decoration: none; font-size: 13px; cursor: pointer;
      }
      .sbx__link:hover { background: rgba(255,255,255,.06); }
      .sbx__link--active { background: #75deff; color: #0c2427; font-weight: 600; }
      .sbx__link--ep { font-size: 12.5px; padding-left: 12px; }
      .sbx__group { margin: 14px 8px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #5e8488; }
      .sbx__badge { margin-left: auto; background: #1f4c50; color: #cfeff7; border-radius: 999px; padding: 0 7px; font-size: 11px; }
      .sbx__verb { font-size: 10px; font-weight: 700; border-radius: 4px; padding: 1px 5px; background: #1f4c50; color: #9fe3f3; }
      .sbx__verb[data-m='POST'] { background: #6a4a12; color: #ffd591; }
      .sbx__main { display: flex; flex-direction: column; min-width: 0; background: #f4f6f8; }
      .sbx__bar {
        display: flex; align-items: center; gap: 12px; padding: 10px 18px; background: #fff;
        border-bottom: 1px solid #e3e6ea; font-size: 13px; color: #5b6470; flex-wrap: wrap;
      }
      .sbx__dot { width: 9px; height: 9px; border-radius: 50%; background: #c7ccd1; }
      .sbx__dot--on { background: #138a52; }
      .sbx__conn { font-weight: 600; color: #2b2f36; }
      .sbx__locale, .sbx__base { margin-left: auto; color: #8c8c8c; font-size: 12px; }
      .sbx__base { margin-left: 0; }
      .sbx__content { padding: 18px; overflow-y: auto; }
    `,
  ],
})
export class SandboxShellComponent {
  private readonly cfg = inject(SandboxConfigService);
  private readonly logs = inject(MobileLogService);

  readonly connected = this.cfg.connected;
  readonly logCount = this.logs.count;
  readonly employeeCode = computed(() => this.cfg.config().employeeCode);
  readonly locale = computed(() => this.cfg.config().locale);
  readonly baseUrl = computed(() => this.cfg.config().baseUrl);

  readonly groups = computed<NavGroup[]>(() => {
    const map = new Map<string, NavGroup>();
    for (const e of ENDPOINTS) {
      if (!map.has(e.journey)) map.set(e.journey, { journey: e.journey, items: [] });
      map.get(e.journey)!.items.push({ id: e.id, label: e.label, method: e.method });
    }
    return [...map.values()];
  });
}
