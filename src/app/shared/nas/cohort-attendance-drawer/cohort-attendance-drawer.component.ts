import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarModule } from 'primeng/sidebar';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { NasIconComponent } from '../nas-icon/nas-icon.component';
import { CoursesApiService } from '../../../features/courses/services/courses-api.service';
import { LocaleService } from '../../../core/services/locale.service';
import type {
  CohortAttendance,
  CohortAttendanceLearner,
  CohortAttendanceSession,
} from '../../../core/models/course.types';

type AttendanceTab    = 'sessions' | 'learners';
type AttendanceFilter = 'all' | 'presence' | 'absence';

/**
 * Right-edge "Attendance Record" drawer for one cohort
 * (Figma nodes 454:42768, 332:11156, 454:38012, 454:38946).
 *
 * Mounted by the course detail page and opened from the cohort row's
 * kebab menu. Backed by a single API call —
 * `GET /api/v1/courses/{course}/cohorts/{cohort}/attendance` — which
 * returns the full rollup (sessions × learners + per-session absentees
 * + per-learner absent sessions + totals) so every interaction in the
 * drawer (tab switch, filter chip, search, expand) is O(1) on the
 * client with no extra round-trips.
 *
 * `cohortId` is `course_sections.id` (the offline group), NOT the
 * legacy "session-as-cohort" id used in the Cohort mapper. The caller
 * is expected to pass `cohort.section_id` from the `Cohort` model.
 */
@Component({
  selector: 'nas-cohort-attendance-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    SidebarModule,
    SkeletonModule,
    TranslateModule,
    NasIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cohort-attendance-drawer.component.html',
  styleUrl: './cohort-attendance-drawer.component.scss',
})
export class CohortAttendanceDrawerComponent implements OnDestroy {
  private readonly api       = inject(CoursesApiService);
  private readonly localeSvc = inject(LocaleService);
  private readonly t         = inject(TranslateService);

  /* ── Inputs / outputs ──────────────────────────────────────────────── */

  /**
   * Signal-backed inputs — required so the `effect()` below actually
   * tracks them. Plain `@Input` fields are not reactive: they fire setters
   * on change but Angular's reactive graph doesn't see them, so the
   * effect would run exactly once at construction and never refetch.
   */
  /** Course id — must be set whenever the drawer is opened. */
  courseId = input<number | null>(null);

  /**
   * Cohort id = `course_sections.id`. The frontend `Cohort` mapper exposes
   * this as `cohort.section_id`; pass that in, NOT `cohort.id`.
   */
  cohortId = input<number | null>(null);

  /**
   * Optimistic header label shown while data is loading. Once the API
   * returns, the server-side localized name takes over.
   */
  cohortName = input<string>('');

  /**
   * Two-way bindable visibility. `model()` lets parents use either the
   * `[(visible)]` two-way syntax or the explicit `[visible]`+`(visibleChange)`
   * pair, while we also write to it locally on backdrop / X click.
   */
  visible = model<boolean>(false);

  /* ── State ─────────────────────────────────────────────────────────── */

  loading  = signal(false);
  data     = signal<CohortAttendance | null>(null);
  errorMsg = signal<string | null>(null);

  tab      = signal<AttendanceTab>('sessions');
  filter   = signal<AttendanceFilter>('all');
  search   = signal('');

  /** Ids of currently expanded rows. Keyed by row id (session id OR learner id
   *  — they live in separate spaces so no clash). */
  expanded = signal<Set<number>>(new Set());

  private readonly destroy$ = new Subject<void>();
  /**
   * Set of (courseId,cohortId) tuples we've already fetched in this open
   * session — guards against the `effect` firing twice in the same open.
   */
  private lastLoaded = '';

  /* ── Derived ───────────────────────────────────────────────────────── */

  /** Header title prefers the API-resolved name; falls back to optimistic input. */
  headerTitle = computed(() => this.data()?.cohort?.name || this.cohortName() || '');

  sessionsCount = computed(() => this.data()?.totals?.sessions ?? 0);
  learnersCount = computed(() => this.data()?.totals?.learners ?? 0);

  /**
   * Sessions tab — filtered + searched.
   *
   * Filter semantics match Figma 454:38946 (Presence) and 454:38012:
   *   - all      → every row, both chips visible per row;
   *   - presence → rows with at least one attendee, only the Attended chip;
   *   - absence  → rows with at least one absent learner, only the Absent chip.
   * Hiding only the rows that have *nothing* to say in the chosen mode
   * keeps the list dense the way the mock shows it, without dropping
   * rows that legitimately have data for the active facet.
   */
  filteredSessions = computed<CohortAttendanceSession[]>(() => {
    const rows = this.data()?.sessions ?? [];
    const q = this.search().trim().toLowerCase();
    const mode = this.filter();
    return rows.filter(s => {
      if (mode === 'presence' && s.attended_count === 0) return false;
      if (mode === 'absence'  && s.absent_count === 0)   return false;
      if (!q) return true;
      const label = this.sessionFallback(s.index).toLowerCase();
      const title = (s.title ?? '').toLowerCase();
      return label.includes(q) || title.includes(q)
          || (s.date ?? '').toLowerCase().includes(q);
    });
  });

  /** Learners tab — same filter semantics as `filteredSessions`. */
  filteredLearners = computed<CohortAttendanceLearner[]>(() => {
    const rows = this.data()?.learners ?? [];
    const q = this.search().trim().toLowerCase();
    const mode = this.filter();
    return rows.filter(l => {
      if (mode === 'presence' && l.attended_count === 0) return false;
      if (mode === 'absence'  && l.absent_count === 0)   return false;
      if (!q) return true;
      return l.name.toLowerCase().includes(q)
          || (l.machine_code ?? '').toLowerCase().includes(q);
    });
  });

  /** Whether the "Attended" chip should render for the current filter. */
  showAttendedChip = computed(() => this.filter() !== 'absence');
  /** Whether the "Absent"   chip should render for the current filter. */
  showAbsentChip   = computed(() => this.filter() !== 'presence');

  /* ── Lifecycle ─────────────────────────────────────────────────────── */

  constructor() {
    // Refetch whenever the drawer becomes visible for a new (course,cohort)
    // pair. Because the inputs are signal-backed (`input()`, `model()`),
    // reading them inside an `effect()` registers the dependency in
    // Angular's reactive graph, so the effect re-runs every time the
    // parent flips visibility or swaps cohorts.
    effect(() => {
      const v        = this.visible();
      const courseId = this.courseId();
      const cohortId = this.cohortId();
      const key      = `${courseId ?? ''}:${cohortId ?? ''}`;

      if (v && courseId && cohortId && key !== this.lastLoaded) {
        this.lastLoaded = key;
        this.load(courseId, cohortId);
      }
      if (!v) {
        // Reset transient UI on close so reopening starts on a clean slate.
        this.lastLoaded = '';
        this.expanded.set(new Set());
        this.search.set('');
        this.filter.set('all');
        this.tab.set('sessions');
      }
    }, { allowSignalWrites: true });

    // Refetch on UI locale change so the cohort/session names come back
    // in the user's current language. The interceptor stamps the
    // `Accept-Language` header from `LocaleService.locale()`.
    this.localeSvc.changes$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const courseId = this.courseId();
        const cohortId = this.cohortId();
        if (this.visible() && courseId && cohortId) {
          this.lastLoaded = '';
          this.load(courseId, cohortId);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Data ──────────────────────────────────────────────────────────── */

  private load(courseId: number, cohortId: number): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    // Clear the previous payload so the empty-state and skeletons render
    // immediately instead of briefly flashing the old cohort's data.
    this.data.set(null);

    this.api.getCohortAttendance(courseId, cohortId).subscribe({
      next: res => {
        this.data.set(res.result ?? null);
        this.loading.set(false);
      },
      error: () => {
        // The user already sees a 4xx/5xx via the global toast; here we
        // just downgrade the drawer to its empty-state.
        this.data.set(null);
        this.loading.set(false);
        this.errorMsg.set(this.t.instant('course_detail.attendance_no_data'));
      },
    });
  }

  /* ── UI handlers ───────────────────────────────────────────────────── */

  onVisibleChange(open: boolean): void {
    this.visible.set(open);
  }

  close(): void {
    this.visible.set(false);
  }

  setTab(t: AttendanceTab): void {
    if (this.tab() === t) return;
    this.tab.set(t);
    this.expanded.set(new Set());
  }

  /**
   * The three filter chips act like a radio group — only one can be on at
   * a time. Clicking the active one falls back to "all".
   */
  setFilter(mode: AttendanceFilter): void {
    this.filter.set(this.filter() === mode ? 'all' : mode);
  }

  toggleExpand(id: number): void {
    const next = new Set(this.expanded());
    next.has(id) ? next.delete(id) : next.add(id);
    this.expanded.set(next);
  }

  isExpanded(id: number): boolean {
    return this.expanded().has(id);
  }

  /* ── Label helpers ─────────────────────────────────────────────────── */

  /** "Session N" label — uses the session's chronological index. */
  sessionFallback(index: number): string {
    return this.t.instant('course_detail.attendance_session_n', { n: index });
  }

  /**
   * Session row label. Figma 454:42768 / 332:11156 ALWAYS render the row
   * title as "Session N" — never the stored `course_sessions.title`. The
   * stored title can be anything (legacy data had it set to "Cohort A"
   * etc, which confused the drawer); the chronological position is what
   * users care about in this view.
   */
  sessionTitle(s: CohortAttendanceSession): string {
    return this.sessionFallback(s.index);
  }

  /** "N Sessions" subline on each learner row. */
  sessionsCountLabel(count: number): string {
    return this.t.instant('course_detail.attendance_sessions_count', { count });
  }

  attendedLabel(count: number): string {
    return this.t.instant('course_detail.attendance_attended', { count });
  }

  absentLabel(count: number): string {
    return this.t.instant('course_detail.attendance_absent', { count });
  }
}
