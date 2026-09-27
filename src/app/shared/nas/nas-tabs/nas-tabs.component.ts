import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, inject } from '@angular/core';

export interface NasTab {
  id:     string;
  label:  string;
  /** Shown beside the label; null, undefined or 0 hides it (Figma 2266:128869: "no content, no number"). */
  count?: number | string | null;
}

/**
 * Pill tabs of the Course Details page (Figma 2266:128869, "Notification
 * Filter" pills): outlined, the active one tinted with a dark outline.
 *
 * ARIA tabs pattern: one tab stop (the active tab), arrow keys / Home / End
 * move and activate, each tab controls `<idPrefix>-panel-<id>`, which the
 * page renders as its `role="tabpanel"`.
 */
@Component({
  selector: 'nas-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-tabs.component.html',
  styleUrl:    './nas-tabs.component.scss',
})
export class NasTabsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() tabs: NasTab[] = [];
  @Input() activeId: string | null = null;
  /** Prefix for tab / panel ids, unique per page. */
  @Input() idPrefix = 'nas-tabs';
  /** Accessible name of the tab list. */
  @Input() label = '';
  @Output() activeIdChange = new EventEmitter<string>();

  select(id: string): void {
    this.activeId = id;
    this.activeIdChange.emit(id);
  }

  hasCount(tab: NasTab): boolean {
    return tab.count !== null && tab.count !== undefined && tab.count !== 0 && tab.count !== '';
  }

  onKeydown(event: KeyboardEvent): void {
    const i = this.tabs.findIndex(t => t.id === this.activeId);
    if (i < 0 || !this.tabs.length) return;
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const step = (d: number) => (i + d + this.tabs.length) % this.tabs.length;
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = step(rtl ? -1 : 1); break;
      case 'ArrowLeft':  next = step(rtl ? 1 : -1); break;
      case 'Home':       next = 0; break;
      case 'End':        next = this.tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    this.select(this.tabs[next].id);
    this.host.nativeElement.querySelector<HTMLElement>(`#${this.idPrefix}-tab-${this.tabs[next].id}`)?.focus();
  }
}
