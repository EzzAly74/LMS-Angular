import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  Directive,
  EventEmitter,
  Input,
  Output,
  QueryList,
  TemplateRef,
  TrackByFunction,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NasShimmerComponent } from './nas-shimmer.component';

/**
 * Cell template injection directive.
 *
 * Example:
 *   <ng-template nasCellTpl="user" let-row let-i="index">
 *     <span>{{ row.name }}</span>
 *   </ng-template>
 */
@Directive({
  selector: '[nasCellTpl]',
  standalone: true,
})
export class NasCellTplDirective {
  @Input('nasCellTpl') field = '';
  constructor(public readonly template: TemplateRef<{ $implicit: unknown; index: number }>) {}
}

export interface NasTableColumn {
  /** field key used to look up `[nasCellTpl]` and the default row property. */
  field:     string;
  /** header label */
  header:    string;
  width?:    string;
  minWidth?: string;
  align?:    'start' | 'center' | 'end';
  /** column has no header text (e.g. row-action column) */
  headerless?: boolean;
}

@Component({
  selector: 'nas-data-table',
  standalone: true,
  imports: [CommonModule, NasShimmerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-data-table.component.html',
  styleUrl:    './nas-data-table.component.scss',
})
export class NasDataTableComponent<T = unknown> implements AfterContentInit {
  @Input() columns:        NasTableColumn[] = [];
  @Input() items:          readonly T[] | null = [];
  @Input() loading         = false;
  @Input() total           = 0;
  @Input() perPage         = 15;
  @Input() page            = 1;
  @Input() paginated       = true;
  @Input() rowClickable    = false;
  @Input() emptyText       = 'No records found';
  @Input() emptyIcon       = 'pi pi-inbox';
  @Input() skeletonRows    = 6;
  /** custom CSS class applied to outer card */
  @Input() cardClass       = '';
  @Input() trackBy: TrackByFunction<T> = (i: number, row: T) =>
    ((row as { id?: number | string })?.id ?? i) as number;

  @Output() pageChange = new EventEmitter<number>();
  @Output() rowClick   = new EventEmitter<T>();

  @ContentChildren(NasCellTplDirective) cellTpls?: QueryList<NasCellTplDirective>;

  /** field → cell template map */
  protected readonly tplMap = signal<Record<string, TemplateRef<{ $implicit: T; index: number }>>>({});

  protected readonly Math = Math;

  ngAfterContentInit(): void {
    this.refreshTemplates();
    this.cellTpls?.changes.subscribe(() => this.refreshTemplates());
  }

  protected get skeletonArray(): number[] {
    return Array.from({ length: Math.max(1, this.skeletonRows) }, (_, i) => i);
  }

  protected get from(): number {
    if (this.total === 0) return 0;
    return (this.page - 1) * this.perPage + 1;
  }

  protected get to(): number {
    return Math.min(this.page * this.perPage, this.total);
  }

  protected get lastPage(): number {
    return Math.max(1, Math.ceil(this.total / Math.max(1, this.perPage)));
  }

  protected onRowClick(row: T): void {
    if (this.rowClickable) this.rowClick.emit(row);
  }

  protected goTo(page: number): void {
    if (page < 1 || page > this.lastPage || page === this.page) return;
    this.pageChange.emit(page);
  }

  protected cellValue(row: T, field: string): unknown {
    const v = (row as Record<string, unknown>)[field];
    return v == null || v === '' ? '—' : v;
  }

  private refreshTemplates(): void {
    const map: Record<string, TemplateRef<{ $implicit: T; index: number }>> = {};
    this.cellTpls?.forEach(d => {
      if (d.field) {
        map[d.field] = d.template as unknown as TemplateRef<{ $implicit: T; index: number }>;
      }
    });
    this.tplMap.set(map);
  }
}
