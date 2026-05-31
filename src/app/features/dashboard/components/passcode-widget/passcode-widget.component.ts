import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasIconComponent } from '../../../../shared/nas';
import {
  PasscodeApiService,
  PasscodeWidget,
} from '../../services/passcode-api.service';

/**
 * Instructor-dashboard "Passcode" widget (Figma 515:34995 / 515:37969 /
 * 515:35489). Lives in the greeting header, directly under the date.
 *
 * Three server-driven states — nothing is fabricated client-side:
 *   • idle  → "Is your session now live?" + Generate Passcode button
 *   • live  → "Passcode" + filled digit boxes (tap to re-open the modal)
 *   • ended → "Passcode" + filled digit boxes + "Session ended" badge
 *
 * Generating opens the Live Passcode modal with the code + cohort /
 * session context, exactly like the mobile S-06 flow it powers.
 */
@Component({
  selector: 'app-passcode-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, DialogModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './passcode-widget.component.html',
  styleUrl: './passcode-widget.component.scss',
})
export class PasscodeWidgetComponent implements OnInit {
  private readonly api = inject(PasscodeApiService);

  readonly widget = signal<PasscodeWidget | null>(null);
  readonly generating = signal(false);
  readonly modalOpen = signal(false);

  readonly state = computed(() => this.widget()?.state ?? 'idle');
  readonly length = computed(() => this.widget()?.passcode_length ?? 5);
  readonly session = computed(() => this.widget()?.session ?? null);
  readonly passcode = computed(() => this.widget()?.passcode ?? null);

  /**
   * The widget only renders for instructors who teach courses — the
   * backend sets `available:false` for everyone else, keeping the
   * passcode affordance off plain admin/super-admin dashboards.
   */
  readonly available = computed(() => this.widget()?.available ?? false);

  /** True when there is a code to display (live or ended). */
  readonly hasCode = computed(
    () => this.state() === 'live' || this.state() === 'ended',
  );

  /**
   * "Generate Passcode" is only actionable when a session is live right
   * now (the backend resolves one into `session`). With no live session
   * the button stays disabled with a hint instead of erroring on click.
   */
  readonly canGenerate = computed(() => !!this.session());

  /** Fixed-length digit cells, padded so the boxes render even mid-fill. */
  readonly digits = computed<string[]>(() => {
    const code = this.passcode()?.code ?? '';
    return Array.from({ length: this.length() }, (_, i) => code[i] ?? '');
  });

  constructor() {
    // Cohort / course names are localized — refetch on language switch.
    withLocaleReload(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.current().subscribe({
      next: (res) => this.widget.set(res.result),
      error: () => {
        /* widget stays hidden on failure — never blocks the dashboard */
      },
    });
  }

  generate(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.api.generate().subscribe({
      next: (res) => {
        this.widget.set(res.result);
        this.generating.set(false);
        this.modalOpen.set(true);
      },
      // The global errorInterceptor already surfaces the backend message
      // (e.g. the 422 "no live session" warning) as a toast — don't add a
      // second one here, just release the button.
      error: () => this.generating.set(false),
    });
  }

  /** Tapping the live digits re-opens the modal with the current code. */
  openModal(): void {
    if (this.hasCode() && this.passcode()) {
      this.modalOpen.set(true);
    }
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }
}
