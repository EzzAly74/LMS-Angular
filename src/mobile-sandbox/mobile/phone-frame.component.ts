import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type PhoneTab = 'fingerprint' | 'services' | 'ask' | 'notification' | 'profile';

/**
 * iPhone-ish chrome that wraps every preview screen so the sandbox looks
 * like the Figma mockups: 375px canvas, status bar (9:41 + signal/wifi/
 * battery), a centered title header with an optional back chevron, a
 * scrollable body, and the NAS bottom navigation + home indicator.
 *
 * Pure presentational — fully self-contained styling so the whole
 * mobile-sandbox folder stays deletable.
 */
@Component({
  selector: 'sbx-phone-frame',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pf">
      <!-- Status bar -->
      <div class="pf__status">
        <span class="pf__time">9:41</span>
        <span class="pf__sys">
          <svg width="18" height="11" viewBox="0 0 18 11" fill="none">
            <rect x="0" y="7" width="3" height="4" rx="1" fill="#171819" />
            <rect x="5" y="5" width="3" height="6" rx="1" fill="#171819" />
            <rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="#171819" />
            <rect x="15" y="0" width="3" height="11" rx="1" fill="#171819" />
          </svg>
          <svg width="16" height="11" viewBox="0 0 16 12" fill="none">
            <path d="M8 2.2c2.3 0 4.4.9 6 2.4l-1.4 1.5A6.6 6.6 0 0 0 8 4.3c-1.7 0-3.3.7-4.6 1.8L2 4.6A8.7 8.7 0 0 1 8 2.2Z" fill="#171819"/>
            <path d="M8 6.1c1.2 0 2.3.5 3.1 1.3L8 10.6 4.9 7.4A4.4 4.4 0 0 1 8 6.1Z" fill="#171819"/>
          </svg>
          <span class="pf__bat"><i></i></span>
        </span>
      </div>

      <!-- Header -->
      @if (title) {
        <div class="pf__head">
          @if (showBack) {
            <button class="pf__back" type="button" (click)="back.emit()" aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 5l-7 7 7 7" stroke="#171819" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          } @else {
            <span class="pf__back pf__back--ghost"></span>
          }
          <span class="pf__title">{{ title }}</span>
          <span class="pf__back pf__back--ghost"></span>
        </div>
      }

      <!-- Body -->
      <div class="pf__body" [class.pf__body--flush]="flush">
        <ng-content></ng-content>
      </div>

      <!-- Bottom nav -->
      @if (showNav) {
        <nav class="pf__nav">
          <button class="pf__navitem" [class.is-active]="activeTab === 'fingerprint'" type="button">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 11v3m-4-2.5a4 4 0 0 1 8 0c0 4-1 6-1 6m-6 0s-1-2-1-5.5M6 9a7 7 0 0 1 12 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            <span>Fingerprint</span>
          </button>
          <button class="pf__navitem" [class.is-active]="activeTab === 'services'" type="button">
            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="7" r="2.3"/><circle cx="7" cy="14" r="2.3"/><circle cx="14" cy="7" r="2.3"/><path d="M14 11.5v5m-2.5-2.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            <span>Services</span>
          </button>
          <button class="pf__navitem" [class.is-active]="activeTab === 'ask'" type="button">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 17V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8l-4 3v-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            <span>Ask NAS</span>
          </button>
          <button class="pf__navitem" [class.is-active]="activeTab === 'notification'" type="button">
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm4 10a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Notification</span>
          </button>
          <button class="pf__navitem" [class.is-active]="activeTab === 'profile'" type="button">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 18.5a6 6 0 0 1 11 0" stroke="currentColor" stroke-width="1.6"/></svg>
            <span>Profile</span>
          </button>
        </nav>
      }

      <div class="pf__home"></div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .pf {
        width: 375px; height: 812px; background: #fdfdfd; position: relative;
        border-radius: 40px; overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 30px 70px rgba(12, 36, 39, .28), 0 0 0 10px #0c2427, 0 0 0 11px #1f4143;
        font-family: 'Fira Sans', system-ui, sans-serif; color: #171819;
      }
      .pf__status {
        height: 48px; display: flex; align-items: center; justify-content: space-between;
        padding: 0 28px 0 30px; flex: none;
      }
      .pf__time { font-weight: 600; font-size: 16px; letter-spacing: -.2px; }
      .pf__sys { display: flex; align-items: center; gap: 6px; }
      .pf__bat { width: 25px; height: 12px; border: 1px solid rgba(23,24,25,.5); border-radius: 3px; position: relative; display: inline-block; }
      .pf__bat::after { content: ''; position: absolute; right: -3px; top: 3.5px; width: 2px; height: 5px; background: rgba(23,24,25,.5); border-radius: 0 2px 2px 0; }
      .pf__bat i { position: absolute; inset: 1.5px; width: 70%; background: #171819; border-radius: 1.5px; display: block; }

      .pf__head { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; flex: none; }
      .pf__title { font-weight: 600; font-size: 16px; color: #171819; }
      .pf__back { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; background: none; border: 0; cursor: pointer; padding: 0; }
      .pf__back--ghost { cursor: default; }

      .pf__body { flex: 1 1 auto; overflow-y: auto; padding: 4px 0 8px; }
      .pf__body--flush { padding: 0; }
      .pf__body::-webkit-scrollbar { width: 0; }

      .pf__nav {
        flex: none; height: 64px; display: flex; align-items: center; justify-content: space-between;
        padding: 8px 18px 4px; background: #fdfdfd;
        border-top-left-radius: 16px; border-top-right-radius: 16px;
        box-shadow: 0 -2px 8px rgba(12,36,39,.08);
      }
      .pf__navitem {
        flex: 1; background: none; border: 0; cursor: pointer; display: flex; flex-direction: column;
        align-items: center; gap: 5px; color: #b8b9ba; font-size: 11px; font-weight: 500;
      }
      .pf__navitem svg { width: 22px; height: 22px; }
      .pf__navitem.is-active { color: #0c2427; }
      .pf__home { flex: none; height: 22px; display: flex; align-items: center; justify-content: center; }
      .pf__home::after { content: ''; width: 134px; height: 5px; border-radius: 100px; background: #171819; }
    `,
  ],
})
export class PhoneFrameComponent {
  @Input() title = '';
  @Input() showBack = false;
  @Input() showNav = false;
  @Input() activeTab: PhoneTab | null = null;
  /** Remove body padding (used by screens that own their own spacing). */
  @Input() flush = false;
  @Output() back = new EventEmitter<void>();
}
