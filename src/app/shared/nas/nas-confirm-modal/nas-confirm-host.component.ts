import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NasConfirmModalComponent } from './nas-confirm-modal.component';
import { NasConfirmService } from './nas-confirm.service';

/** Mounted once in the admin layout; draws NasConfirmService requests. */
@Component({
  selector: 'nas-confirm-host',
  standalone: true,
  imports: [NasConfirmModalComponent, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.request(); as r) {
      <nas-confirm-modal
        [visible]="true"
        [title]="r.title"
        [message]="r.message"
        [danger]="r.danger !== false"
        [confirmLabel]="r.confirmLabel ?? ((r.danger !== false ? 'common.yes_delete' : 'common.confirm') | translate)"
        [cancelLabel]="r.cancelLabel ?? ('common.cancel' | translate)"
        (confirm)="confirm.settle(true)"
        (cancel)="confirm.settle(false)" />
    }
  `,
})
export class NasConfirmHostComponent {
  protected readonly confirm = inject(NasConfirmService);
}
