import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NasIconComponent } from '../nas-icon/nas-icon.component';

export interface NasActionMenuItem {
  id: string;
  label: string;
  /** A Phosphor icon name (assets/icons/phosphor). */
  icon: string;
}

let nextId = 0;

/**
 * A toolbar button that opens a small titled panel of actions - the Import
 * and Export menus of Figma 1983:44634 / 2066:99852: a header with the title
 * and a close button, then one row per action.
 *
 * A disclosure (button + panel), not an ARIA menu: the rows are plain
 * buttons, reached with Tab. Escape and a click outside close it, and focus
 * goes back to the button.
 */
@Component({
  selector: 'nas-action-menu',
  standalone: true,
  imports: [TranslateModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-action-menu.component.html',
  styleUrl: './nas-action-menu.component.scss',
})
export class NasActionMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Button text, already translated. */
  readonly label = input.required<string>();
  /** The panel's title, already translated. */
  readonly title = input.required<string>();
  /** Figma asset shown before the label (assets/icons/figma). */
  readonly icon = input.required<string>();
  readonly items = input.required<NasActionMenuItem[]>();
  readonly disabled = input(false);
  readonly picked = output<string>();

  protected readonly open = signal(false);
  protected readonly uid = `nas-am-${nextId++}`;
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    // Move focus into the panel once it is rendered.
    queueMicrotask(() => this.panel()?.nativeElement.querySelector<HTMLButtonElement>('.nas-am__item')?.focus());
  }

  protected choose(item: NasActionMenuItem): void {
    this.close();
    this.picked.emit(item.id);
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  @HostListener('keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
