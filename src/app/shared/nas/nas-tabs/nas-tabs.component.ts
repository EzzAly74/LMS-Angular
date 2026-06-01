import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface NasTab {
  id:     string;
  label:  string;
  count?: number | null;
}

/** Underlined tabs used on detail pages (Overview / Cohort / Learners…) */
@Component({
  selector: 'nas-tabs',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-tabs.component.html',
  styleUrl:    './nas-tabs.component.scss',
})
export class NasTabsComponent {
  @Input() tabs: NasTab[] = [];
  @Input() activeId: string | null = null;
  @Output() activeIdChange = new EventEmitter<string>();

  select(id: string): void {
    this.activeId = id;
    this.activeIdChange.emit(id);
  }
}
