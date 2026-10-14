import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, inject, input, signal } from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NasIconComponent } from '../nas-icon/nas-icon.component';

/**
 * Editor for a reorder question's items (quizzes and assignments): one card
 * per item with its English and Arabic text side by side (option N is a pair,
 * NEW2B-6288). The author types the items in any order, then drags them into
 * the correct order: the list order IS the answer key (D-066). Learners always
 * get them shuffled.
 *
 * Keyboard: on a card's handle, Arrow Up / Down moves the item; every move is
 * announced. Both FormArrays move together, so the pairs never come apart.
 */
@Component({
  selector: 'nas-order-editor',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, NasIconComponent],
  templateUrl: './nas-order-editor.component.html',
  styleUrl: './nas-order-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NasOrderEditorComponent {
  /** The English items, in the correct order. */
  readonly en = input.required<FormArray<FormControl<string>>>();
  /** The Arabic items, paired with `en` by position. */
  readonly ar = input.required<FormArray<FormControl<string>>>();
  /** Unique per question, for ids. */
  readonly uid = input.required<string>();
  /** Fewer items than this cannot be removed. */
  readonly min = input(2);

  private readonly t = inject(TranslateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Polite announcement of the last move, for screen readers. */
  protected readonly announcement = signal('');

  protected rows(): number[] {
    return this.en().controls.map((_, i) => i);
  }

  /** A row filled in one language only. */
  protected half(i: number): boolean {
    const en = (this.en().at(i)?.value ?? '').trim();
    const ar = (this.ar().at(i)?.value ?? '').trim();
    return !!en !== !!ar;
  }

  protected add(): void {
    this.en().push(new FormControl('', { nonNullable: true }));
    this.ar().push(new FormControl('', { nonNullable: true }));
    this.markDirty();
    const next = this.en().length - 1;
    this.focusAfterRender(`#${this.uid()}-en-${next}`);
  }

  protected remove(i: number): void {
    if (this.en().length <= this.min()) return;
    this.en().removeAt(i);
    if (i < this.ar().length) this.ar().removeAt(i);
    this.markDirty();
  }

  protected dropped(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  /** Arrow Up / Down on a handle moves its card, then keeps focus on it. */
  protected onHandleKey(event: KeyboardEvent, i: number): void {
    const to = event.key === 'ArrowUp' ? i - 1 : event.key === 'ArrowDown' ? i + 1 : null;
    if (to === null) return;
    event.preventDefault();
    if (to < 0 || to >= this.en().length) return;
    this.move(i, to);
    this.focusAfterRender(`#${this.uid()}-handle-${to}`);
  }

  private move(from: number, to: number): void {
    if (from === to) return;
    for (const arr of [this.en(), this.ar()]) {
      if (from >= arr.length) continue;
      const control = arr.at(from);
      arr.removeAt(from, { emitEvent: false });
      arr.insert(Math.min(to, arr.length), control);
    }
    this.markDirty();
    this.announcement.set(this.t.instant('order_editor.moved', { position: to + 1, count: this.en().length }));
  }

  private markDirty(): void {
    this.en().markAsDirty();
    this.ar().markAsDirty();
  }

  /** Focuses `selector` once the moved / added row is on screen. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), { injector: this.injector });
  }
}
