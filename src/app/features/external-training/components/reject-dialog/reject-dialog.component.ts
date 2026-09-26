import { ChangeDetectionStrategy, Component, computed, effect, input, model, output, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { REASON_MAX } from '../../models/external-training.model';

let nextId = 0;

/**
 * "Rejection reason" - Figma 2209:90462. Submit stays disabled until there
 * is a reason; the server requires one too (AdminExternalTrainingRejectRequest).
 * The parent sends it and passes back `busy` / `error`.
 */
@Component({
  selector: 'app-reject-dialog',
  standalone: true,
  imports: [TranslateModule, DialogModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog #rjdDlg [visible]="visible()" (visibleChange)="visible.set($event)" [modal]="true" [closable]="true"
      [draggable]="false" [resizable]="false" [dismissableMask]="!busy()" [closeOnEscape]="!busy()" styleClass="rjd"
      [style]="{ width: '627px', maxWidth: 'calc(100vw - 32px)' }">
      <ng-template pTemplate="headless">
        <form class="rjd__card" (submit)="send(); $event.preventDefault()">
          <header class="rjd__head">
            <h2 class="rjd__title" [id]="rjdDlg.ariaLabelledBy">{{ 'external_training.reject.title' | translate }}</h2>
            <button type="button" class="rjd__close" [disabled]="busy()" (click)="visible.set(false)"
              [attr.aria-label]="'common.close' | translate">
              <img src="assets/icons/figma/close-x.svg" width="16" height="16" alt="" />
            </button>
          </header>
          <div class="rjd__body">
            <label class="rjd__label" [for]="uid + '-reason'">{{ 'external_training.reject.label' | translate }}</label>
            <textarea #reasonEl class="rjd__input" [id]="uid + '-reason'" rows="4" dir="auto" [attr.maxlength]="max"
              [placeholder]="'external_training.reject.placeholder' | translate" [value]="reason()"
              [attr.aria-describedby]="uid + '-hint'" [attr.aria-invalid]="!!error()"
              (input)="reason.set(reasonEl.value)"></textarea>
            <p class="rjd__hint" [id]="uid + '-hint'">
              {{ 'external_training.reject.hint' | translate }}
              <span class="rjd__count"><bdi dir="ltr">{{ reason().length }}/{{ max }}</bdi></span>
            </p>
            @if (error(); as msg) { <p class="rjd__error" role="alert">{{ msg }}</p> }
          </div>
          <footer class="rjd__foot">
            <button type="button" class="rjd__btn rjd__btn--ghost" [disabled]="busy()" (click)="visible.set(false)">
              {{ 'common.cancel' | translate }}
            </button>
            <button type="submit" class="rjd__btn rjd__btn--primary" [disabled]="!canSend()">
              <nas-icon name="check" [size]="20" />
              {{ (busy() ? 'common.saving' : 'external_training.reject.submit') | translate }}
            </button>
          </footer>
        </form>
      </ng-template>
    </p-dialog>
  `,
  styleUrl: './reject-dialog.component.scss',
})
export class RejectDialogComponent {
  readonly visible = model(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly submitted = output<string>();

  protected readonly uid = `rjd-${nextId++}`;
  protected readonly max = REASON_MAX;
  protected readonly reason = signal('');
  protected readonly canSend = computed(() => !this.busy() && this.reason().trim().length > 0);

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.reason.set(''));
    }, { allowSignalWrites: true });
  }

  protected send(): void {
    if (this.canSend()) this.submitted.emit(this.reason().trim());
  }
}
