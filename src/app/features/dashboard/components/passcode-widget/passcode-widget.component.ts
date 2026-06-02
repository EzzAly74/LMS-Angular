import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasIconComponent } from '../../../../shared/nas';
import {
  EligibleCohort,
  EligibleCourse,
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
type ModalPhase = 'pick' | 'result';

@Component({
  selector: 'app-passcode-widget',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    DialogModule,
    DropdownModule,
    NasIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './passcode-widget.component.html',
  styleUrl: './passcode-widget.component.scss',
})
export class PasscodeWidgetComponent implements OnInit {
  private readonly api = inject(PasscodeApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly widget = signal<PasscodeWidget | null>(null);
  readonly generating = signal(false);
  /** True while a rotate/regenerate request is in flight. */
  readonly regenerating = signal(false);
  /** True while an "End Session" request is in flight. */
  readonly endingSession = signal(false);
  readonly modalOpen = signal(false);

  /** Wall-clock tick (ms) — drives the live "resets in mm:ss" countdown. */
  private readonly nowMs = signal(Date.now());

  /** Two-phase dialog: pick a course/cohort, then show the issued code. */
  readonly phase = signal<ModalPhase>('pick');

  /** Courses (+ cohorts) the instructor can start a session for. */
  readonly courses = signal<EligibleCourse[]>([]);
  readonly coursesLoading = signal(false);
  readonly selectedCourseId = signal<number | null>(null);
  readonly selectedCohortId = signal<number | null>(null);

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

  /** Rotating-passcode mode (Course Attendance = No in platform settings). */
  readonly rotates = computed(() => this.widget()?.rotates ?? false);

  /** Epoch ms at which the current code expires (null when no code). */
  private readonly expiresAtMs = computed(() => {
    const iso = this.passcode()?.expires_at;
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  });

  /** Whole seconds left before the current code resets (0 once expired). */
  readonly remainingSeconds = computed(() => {
    const expiry = this.expiresAtMs();
    if (expiry === null) return 0;
    return Math.max(0, Math.ceil((expiry - this.nowMs()) / 1000));
  });

  /**
   * The displayed code is no longer valid — either the backend already
   * reported it expired, the live countdown ran out, or we're in the
   * "ended" state. Drives the "expired" styling + Regenerate affordance.
   */
  readonly expired = computed(() => {
    if (this.state() === 'ended') return true;
    if (this.passcode()?.expired) return true;
    return this.expiresAtMs() !== null && this.remainingSeconds() <= 0;
  });

  /**
   * "Generate Passcode" opens the picker. It's only actionable when the
   * instructor has at least one course with a still-runnable cohort;
   * otherwise the button stays disabled with a hint.
   */
  readonly canGenerate = computed(() => this.courses().length > 0);

  /** Cohorts of the currently-selected course (drives the 2nd dropdown). */
  readonly cohortsForSelected = computed<EligibleCohort[]>(() => {
    const id = this.selectedCourseId();
    return this.courses().find((c) => c.id === id)?.cohorts ?? [];
  });

  /** Both selections present and no request in flight. */
  readonly canStart = computed(
    () =>
      !this.generating() &&
      this.selectedCourseId() !== null &&
      this.selectedCohortId() !== null,
  );

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

    // 1s heartbeat: refresh the countdown and, in rotating mode, auto
    // re-issue a fresh code the moment the current one lapses so the
    // mobile S-06 screen always has a valid passcode to match.
    const timer = setInterval(() => {
      this.nowMs.set(Date.now());
      this.maybeAutoRotate();
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  /**
   * Silent auto-rotate. Fires for a *live* rotating code the instant it
   * lapses so a fresh passcode appears with zero user action (Figma
   * 515:35009 — "Reset passcode will appear here automatically"). Never
   * loops: a finished session comes back from the server as "ended"/"idle"
   * (state !== 'live'), and ending a session halts it too.
   */
  private maybeAutoRotate(): void {
    if (
      this.rotates() &&
      this.state() === 'live' &&
      this.expired() &&
      !this.regenerating() &&
      !this.generating() &&
      !this.endingSession()
    ) {
      this.regenerate();
    }
  }

  load(): void {
    this.api.current().subscribe({
      next: (res) => {
        this.widget.set(res.result);
        if (res.result?.available) this.loadCourses();
      },
      error: () => {
        /* widget stays hidden on failure — never blocks the dashboard */
      },
    });
  }

  private loadCourses(): void {
    this.coursesLoading.set(true);
    this.api.courses().subscribe({
      next: (res) => {
        this.courses.set(res.result ?? []);
        this.coursesLoading.set(false);
      },
      error: () => this.coursesLoading.set(false),
    });
  }

  /** Open the dialog in the course/cohort selection phase. */
  openPicker(): void {
    this.selectedCourseId.set(null);
    this.selectedCohortId.set(null);
    this.phase.set('pick');
    this.modalOpen.set(true);
  }

  /** Reset the cohort when the course changes; auto-pick a lone cohort. */
  onCourseChange(): void {
    const cohorts = this.cohortsForSelected();
    this.selectedCohortId.set(cohorts.length === 1 ? cohorts[0].id : null);
  }

  /** Start the session for the chosen course + cohort, then show the code. */
  start(): void {
    if (!this.canStart()) return;
    const courseId = this.selectedCourseId()!;
    const cohortId = this.selectedCohortId()!;
    this.generating.set(true);
    this.api.start(courseId, cohortId).subscribe({
      next: (res) => {
        this.widget.set(res.result);
        this.generating.set(false);
        this.phase.set('result');
      },
      // The global errorInterceptor already surfaces the backend message
      // (e.g. the 422 "cohort unavailable" warning) as a toast.
      error: () => this.generating.set(false),
    });
  }

  /**
   * Rotate the current code: re-issue a fresh passcode on the live
   * session. Used by the manual "Regenerate" button and the rotating
   * auto-refresh. No-ops while a request is already in flight.
   */
  regenerate(): void {
    if (this.regenerating()) return;
    this.regenerating.set(true);
    this.api.regenerate().subscribe({
      next: (res) => {
        this.widget.set(res.result);
        this.regenerating.set(false);
      },
      // The error interceptor surfaces the backend message as a toast.
      error: () => this.regenerating.set(false),
    });
  }

  /**
   * End the current live session: revoke the passcode + close the window.
   * The widget reverts to the idle "Generate Passcode" state and the
   * rotating auto-refresh stops.
   */
  endSession(): void {
    if (this.endingSession()) return;
    this.endingSession.set(true);
    this.api.end().subscribe({
      next: (res) => {
        this.widget.set(res.result);
        this.endingSession.set(false);
        this.closeModal();
      },
      error: () => this.endingSession.set(false),
    });
  }

  /** Tapping the live digits re-opens the modal with the current code. */
  openModal(): void {
    if (this.hasCode() && this.passcode()) {
      this.phase.set('result');
      this.modalOpen.set(true);
    }
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }
}
