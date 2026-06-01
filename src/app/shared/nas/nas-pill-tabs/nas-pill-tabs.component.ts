import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface NasPillTab {
  id:     string;
  label:  string;
  count?: number | null;
}

@Component({
  selector: 'nas-pill-tabs',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-pill-tabs.component.html',
  styleUrl:    './nas-pill-tabs.component.scss',
})
export class NasPillTabsComponent {
  @Input() tabs: NasPillTab[] = [];
  @Input() activeId: string | null = null;
  @Output() activeIdChange = new EventEmitter<string>();

  select(id: string): void {
    this.activeId = id;
    this.activeIdChange.emit(id);
  }
}
