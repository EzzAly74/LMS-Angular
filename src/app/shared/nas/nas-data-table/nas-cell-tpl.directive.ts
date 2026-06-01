import { Directive, Input, TemplateRef } from '@angular/core';

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
