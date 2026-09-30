import {
  ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NasIconComponent } from '../nas-icon/nas-icon.component';

let nextId = 0;

/**
 * The toolbar over every Dashboard list (reference: All Courses, Figma
 * 2393:123975; Course Details tabs 2266:129915): a search box and, when the
 * list has filters, the Filter button with the number of active filters
 * (2295:52409). Page-specific controls (chips, export, date range) go in the
 * content slot after the Filter button.
 *
 * The box emits every keystroke as typed; the list debounces and trims
 * (PagedList.search). The typed text is never rewritten while the admin types
 * (a trimmed "data " is still "data " in the box); it only follows `search`
 * when that changes for another reason, e.g. a Clear.
 */
@Component({
  selector: 'nas-list-toolbar',
  standalone: true,
  imports: [TranslateModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nlt">
      <div class="nlt__search">
        <nas-icon name="magnifying-glass" [size]="20" />
        <label class="nlt__sr" [for]="inputId">{{ label() }}</label>
        <input #box [id]="inputId" type="search" class="nlt__input" autocomplete="off"
          [placeholder]="placeholder()" (input)="searchChange.emit(box.value)" />
      </div>
      @if (filterCount() !== null) {
        <button type="button" class="nlt__filter" [class.nlt__filter--on]="(filterCount() ?? 0) > 0"
          aria-haspopup="dialog" (click)="filter.emit()">
          <nas-icon name="funnel" [size]="20" />
          <span>{{ 'common.filter' | translate }}</span>
          @if ((filterCount() ?? 0) > 0) {
            <span class="nlt__badge" [attr.aria-label]="'common.filters_on' | translate: { count: filterCount() }">{{ filterCount() }}</span>
          }
        </button>
      }
      <ng-content />
    </div>
  `,
  styleUrl: './nas-list-toolbar.component.scss',
})
export class NasListToolbarComponent {
  /** The applied search term (after debounce and trim). */
  readonly search = input('');
  /** Placeholder, already translated. */
  readonly placeholder = input.required<string>();
  /** Accessible name of the search box, already translated. */
  readonly label = input.required<string>();
  /** Active filter count; null when the list has no Filter button. */
  readonly filterCount = input<number | null>(null);

  readonly searchChange = output<string>();
  readonly filter = output<void>();

  protected readonly inputId = `nas-list-search-${nextId++}`;
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  constructor() {
    effect(() => {
      const applied = this.search();
      const el = this.box().nativeElement;
      if (el.value.trim() !== applied) el.value = applied;
    });
  }
}
