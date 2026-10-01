import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Renders its element only when the admin holds the permission (D-073):
 *
 *   <button *nasCan="'create-courses'">Add course</button>
 *   <button *nasCan="['edit-courses', 'delete-courses']">…</button>   (any of)
 *
 * UX only: it removes controls the server would refuse. Reacts to the
 * session, so a permission change applies on the next /me refresh.
 */
@Directive({ selector: '[nasCan]', standalone: true })
export class NasCanDirective {
  readonly nasCan = input.required<string | readonly string[]>();

  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private shown = false;

  constructor() {
    effect(() => {
      const need = this.nasCan();
      const allowed = typeof need === 'string' ? this.auth.can(need) : need.some(p => this.auth.can(p));

      if (allowed && !this.shown) {
        this.container.createEmbeddedView(this.template);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.container.clear();
        this.shown = false;
      }
    });
  }
}
