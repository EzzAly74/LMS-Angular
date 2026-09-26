import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';

export interface NasImportProblem {
  row: number;
  column: string | null;
  message: string;
}

/**
 * The report shown when an import is rejected (D-034): nothing was written,
 * and every problem is listed by spreadsheet row and column. Shared by the
 * Evaluation templates and Qualifications imports.
 */
@Component({
  selector: 'nas-import-report',
  standalone: true,
  imports: [TranslateModule, DialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="visible()" (visibleChange)="visible.set($event)" [modal]="true" [closable]="true"
      [draggable]="false" [resizable]="false" [dismissableMask]="true" styleClass="nas-import-report"
      [style]="{ width: '640px', maxWidth: 'calc(100vw - 32px)' }" [header]="'import_report.title' | translate">
      <p class="nir__lead" role="alert">{{ 'import_report.rejected' | translate: { count: errors().length } }}</p>
      <div class="nir__scroll">
        <table class="nir__table">
          <thead>
            <tr>
              <th scope="col">{{ 'import_report.row' | translate }}</th>
              <th scope="col">{{ 'import_report.column' | translate }}</th>
              <th scope="col">{{ 'import_report.problem' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (e of errors(); track $index) {
              <tr>
                <td>{{ e.row || '-' }}</td>
                <td><bdi dir="ltr">{{ e.column ?? '-' }}</bdi></td>
                <td>{{ e.message }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </p-dialog>
  `,
  styles: `
    /* PrimeNG's dialog sets its own font-family. */
    .nir__lead, .nir__table { font-family: var(--nas-font); }
    :host-context([dir='rtl']) .nir__lead, :host-context([dir='rtl']) .nir__table { font-family: var(--nas-font-ar); }
    .nir__lead { margin: 0 0 var(--nas-space-3); font-size: var(--nas-size-xs); color: var(--nas-color-text-strong); }
    .nir__scroll { max-block-size: 50vh; overflow: auto; border: 1px solid var(--nas-color-border); border-radius: var(--nas-radius-md); }
    .nir__table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--nas-size-2xs);

      th, td { padding: var(--nas-space-2) var(--nas-space-3); text-align: start; border-block-end: 1px solid var(--nas-color-border); vertical-align: top; }
      th { background: var(--nas-neutral-50); font-weight: var(--nas-weight-medium); color: var(--nas-color-text-muted); position: sticky; inset-block-start: 0; }
      td:first-child { white-space: nowrap; }
    }
  `,
})
export class NasImportReportComponent {
  readonly visible = model(false);
  readonly errors = input.required<readonly NasImportProblem[]>();
}
