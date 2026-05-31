import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MobileDataService } from '../mobile-data.service';
import { CohortBlock, CourseDetail, CourseUnit } from '../mobile.models';
import { ApiCallResult } from '../../core/mobile-api.service';
import { CourseCoverComponent } from '../ui/course-cover.component';

/** S-03 — Course detail & enrolment. */
@Component({
  selector: 'sbx-course-detail-screen',
  standalone: true,
  imports: [CommonModule, CourseCoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="cd"><div class="skel skel--lg"></div><div class="skel"></div><div class="skel"></div></div>
    }
    @if (error()) {
      <div class="cd"><div class="msg msg--err"><strong>{{ error()?.status }}</strong> {{ error()?.message }}</div></div>
    }
    @if (course(); as c) {
      <div class="cd">
        <!-- Title row -->
        <div class="cd__hero">
          <sbx-course-cover [image]="c.image" [seed]="c.id" [size]="56" [radius]="12" />
          <div class="cd__herotxt">
            <h1>{{ c.title }}</h1>
            <div class="cd__sub">
              <span class="rate"><svg viewBox="0 0 24 24" fill="#f5a623"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8-4.3-4.1 5.9-.9L12 3Z"/></svg>{{ ratingText(c) }} ({{ c.rating?.count || 0 }})</span>
              <span class="meta-i"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="16" rx="2" stroke="#595959" stroke-width="1.6"/><path d="M4 9h16M8 3v3m8-3v3" stroke="#595959" stroke-width="1.6" stroke-linecap="round"/></svg>{{ shortDate(cohort(c)?.start_date) }}</span>
              <span class="meta-i"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="#595959" stroke-width="1.6"/><path d="M12 9v6m-3-3h6" stroke="#595959" stroke-width="1.6" stroke-linecap="round"/></svg>{{ typeText(c) }}</span>
            </div>
          </div>
        </div>

        <!-- Next cohort -->
        @if (cohort(c); as co) {
          <div class="cd__section-label">NEXT COHORT</div>
          <div class="cohort">
            <div class="cohort__row">
              <span class="avatar">{{ initials(c.instructors?.[0]?.name) }}</span>
              <div><div class="cohort__k">Instructor</div><div class="cohort__v">{{ c.instructors?.[0]?.name || '—' }}</div></div>
            </div>
            <div class="cohort__row">
              <span class="ico"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="16" rx="2" stroke="#0c2427" stroke-width="1.6"/><path d="M4 9h16M8 3v3m8-3v3" stroke="#0c2427" stroke-width="1.6" stroke-linecap="round"/></svg></span>
              <div><div class="cohort__k">Starts</div><div class="cohort__v">{{ longDate(co.start_date) }}</div></div>
            </div>
            <div class="cohort__row">
              <span class="ico"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="#0c2427" stroke-width="1.6"/><path d="M12 9v6m-3-3h6" stroke="#0c2427" stroke-width="1.6" stroke-linecap="round"/></svg></span>
              <div><div class="cohort__k">Round</div><div class="cohort__v">{{ co.name }}</div></div>
            </div>
            <div class="cohort__row">
              <span class="ico"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12h12m0 0-4-4m4 4-4 4M16 4h4v16h-4" stroke="#0c2427" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
              <div><div class="cohort__k">Ends</div><div class="cohort__v">{{ longDate(co.end_date) }}</div></div>
            </div>
            @if (co.capacity != null) {
              <div class="cohort__row cohort__row--last">
                <span class="ico"><svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="#0c2427" stroke-width="1.6"/><circle cx="17" cy="9" r="2.2" stroke="#0c2427" stroke-width="1.6"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M15 19a4 4 0 0 1 6 0" stroke="#0c2427" stroke-width="1.6" stroke-linecap="round"/></svg></span>
                <div class="cohort__seats">
                  <div class="cohort__k">Seats</div>
                  <div class="cohort__v">{{ co.seats_left ?? 0 }} of {{ co.capacity }} remaining</div>
                </div>
              </div>
              <div class="bar"><i [style.width.%]="seatsPct(co)"></i></div>
            }
          </div>
        }

        <!-- About -->
        @if (c.description) {
          <div class="cd__section-label">ABOUT THIS COURSE</div>
          <p class="cd__about" [class.cd__about--clamp]="!expanded()">{{ c.description }}</p>
          <button class="cd__more" type="button" (click)="expanded.set(!expanded())">{{ expanded() ? 'Show less' : 'Show more' }}</button>
        }

        <!-- Qualifications -->
        @if (c.qualifications?.length) {
          <div class="cd__section-label">QUALIFICATIONS EARNED</div>
          <div class="quals">
            @for (q of c.qualifications; track q.id) {
              <div class="qual"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="#0e8c4f"/><path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>{{ q.name }}</div>
            }
          </div>
        }

        <!-- Content -->
        @if (c.units?.length) {
          <div class="cd__section-label">COURSE CONTENT</div>
          <div class="units">
            @for (u of visibleUnits(c); track u.id; let i = $index) {
              <div class="unit">
                <span class="unit__n">{{ pad(i + 1) }}</span>
                <div class="unit__body">
                  <div class="unit__t">{{ u.title }}</div>
                  <div class="unit__d"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#8a8f98" stroke-width="1.6"/><path d="M12 8v4l3 2" stroke="#8a8f98" stroke-width="1.6" stroke-linecap="round"/></svg>{{ duration(u) }}</div>
                </div>
                <span class="unit__tag" [attr.data-t]="unitType(u)">{{ unitType(u) }}</span>
              </div>
            }
          </div>
          @if ((c.units?.length || 0) > 3) {
            <button class="cd__viewall" type="button" (click)="showAllUnits.set(!showAllUnits())">
              {{ showAllUnits() ? 'Show less' : 'View all ' + c.units!.length + ' units' }}
            </button>
          }
        }

        <div class="cd__spacer"></div>
      </div>

      <!-- Sticky CTA -->
      <div class="cd__cta">
        @if (enrolMsg()) {
          <div class="cd__enrolmsg" [class.cd__enrolmsg--err]="!enrolOk()">{{ enrolMsg() }}</div>
        }
        <button type="button" class="cd__btn" [disabled]="!ctaEnabled(c) || enrolling()" (click)="onEnrol(c)">
          {{ enrolling() ? 'Submitting…' : ctaLabel(c) }}
        </button>
      </div>
    }
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; height: 100%; }
      .cd { display: flex; flex-direction: column; padding: 4px 24px 0; overflow-y: auto; flex: 1; }
      .cd::-webkit-scrollbar { width: 0; }
      .cd__hero { display: flex; gap: 12px; align-items: center; padding: 8px 0 16px; }
      .cd__herotxt h1 { margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #171819; line-height: 1.2; }
      .cd__sub { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #595959; flex-wrap: wrap; }
      .rate { display: flex; align-items: center; gap: 3px; font-weight: 600; color: #171819; }
      .rate svg { width: 14px; height: 14px; }
      .meta-i { display: flex; align-items: center; gap: 3px; }
      .meta-i svg { width: 13px; height: 13px; }

      .cd__section-label { font-size: 11px; font-weight: 600; letter-spacing: .06em; color: #8a8f98; margin: 18px 0 8px; }
      .cohort { border: 1px solid #e6e7e8; border-radius: 14px; padding: 4px 14px 14px; box-shadow: 0 1px 1px rgba(0,0,0,.05); }
      .cohort__row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
      .cohort__row--last { border-bottom: 0; }
      .avatar { width: 34px; height: 34px; border-radius: 50%; background: #3a5a5c; color: #d4f5ff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex: none; }
      .ico { width: 34px; display: flex; justify-content: center; flex: none; }
      .ico svg { width: 20px; height: 20px; }
      .cohort__k { font-size: 11px; color: #8a8f98; }
      .cohort__v { font-size: 14px; font-weight: 600; color: #171819; }
      .cohort__seats { flex: 1; }
      .bar { height: 6px; background: #eef0f0; border-radius: 6px; overflow: hidden; margin-top: 2px; }
      .bar i { display: block; height: 100%; background: linear-gradient(90deg,#0c2427,#3fb6a8); border-radius: 6px; }

      .cd__about { font-size: 13px; line-height: 1.55; color: #4b5159; margin: 0; }
      .cd__about--clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      .cd__more { background: none; border: 0; padding: 6px 0 0; font-family: inherit; font-size: 12px; font-weight: 600; color: #171819; text-decoration: underline; cursor: pointer; align-self: flex-start; }

      .quals { display: flex; flex-direction: column; gap: 8px; }
      .qual { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #171819; }
      .qual svg { width: 18px; height: 18px; flex: none; }

      .units { display: flex; flex-direction: column; gap: 0; border: 1px solid #e6e7e8; border-radius: 14px; overflow: hidden; }
      .unit { display: flex; align-items: center; gap: 12px; padding: 14px; border-bottom: 1px solid #f0f0f0; }
      .unit:last-child { border-bottom: 0; }
      .unit__n { width: 26px; height: 26px; border-radius: 8px; background: #f2fbfa; color: #0c2427; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex: none; }
      .unit__body { flex: 1; min-width: 0; }
      .unit__t { font-size: 14px; font-weight: 600; color: #171819; line-height: 1.2; }
      .unit__d { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #8a8f98; margin-top: 2px; }
      .unit__d svg { width: 13px; height: 13px; }
      .unit__tag { font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 8px; flex: none; background: #eef6f5; color: #0c6157; }
      .unit__tag[data-t='Session'] { background: #f3f4f6; color: #595959; }
      .unit__tag[data-t='Document'] { background: #efeaff; color: #5b3ec7; }

      .cd__viewall { margin-top: 10px; width: 100%; border: 1px solid #e6e7e8; background: #fff; border-radius: 12px; padding: 12px; font-family: inherit; font-size: 13px; font-weight: 600; color: #171819; cursor: pointer; }
      .cd__spacer { height: 8px; }

      .cd__cta { flex: none; padding: 12px 24px 16px; background: #fdfdfd; border-top: 1px solid #f0f0f0; }
      .cd__btn { width: 100%; height: 52px; border: 0; border-radius: 14px; background: #0c2427; color: #fff; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
      .cd__btn:disabled { opacity: .45; cursor: not-allowed; }
      .cd__enrolmsg { font-size: 12px; color: #0e8c4f; text-align: center; margin-bottom: 8px; }
      .cd__enrolmsg--err { color: #e5484d; }

      .skel { height: 64px; border-radius: 14px; background: linear-gradient(90deg,#eee,#f6f6f6,#eee); background-size: 200% 100%; animation: sh 1.2s infinite; margin-bottom: 12px; }
      .skel--lg { height: 120px; }
      @keyframes sh { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      .msg { padding: 16px; border-radius: 12px; background: #f5f5f5; color: #595959; font-size: 13px; text-align: center; }
      .msg--err { background: #fdecec; color: #c0392b; }
    `,
  ],
})
export class CourseDetailScreenComponent implements OnChanges {
  @Input() courseId!: number;
  @Output() back = new EventEmitter<void>();
  @Output() enrol = new EventEmitter<CourseDetail>();
  @Output() apiResult = new EventEmitter<ApiCallResult>();

  private readonly data = inject(MobileDataService);

  readonly course = signal<CourseDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiCallResult | null>(null);
  readonly expanded = signal(false);
  readonly showAllUnits = signal(false);
  readonly enrolling = signal(false);
  readonly enrolMsg = signal<string | null>(null);
  readonly enrolOk = signal(false);

  ngOnChanges(): void {
    if (this.courseId) {
      this.enrolMsg.set(null);
      void this.load();
    }
  }

  async onEnrol(c: CourseDetail): Promise<void> {
    if (!this.ctaEnabled(c) || this.enrolling()) return;
    this.enrolling.set(true);
    this.enrolMsg.set(null);
    try {
      const { call } = await this.data.enrol(c.id, this.cohort(c)?.id ?? null);
      this.apiResult.emit(call);
      this.enrolOk.set(call.ok);
      this.enrolMsg.set(
        call.ok ? (call.message || 'Enrolment confirmed.') : (call.message || 'Could not enrol.'),
      );
      if (call.ok) {
        this.enrol.emit(c);
        await this.load(); // refresh CTA → "Already Enrolled"
      }
    } finally {
      this.enrolling.set(false);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.course.set(null);
    try {
      const { data, call } = await this.data.courseDetail(this.courseId);
      this.apiResult.emit(call);
      if (!call.ok) this.error.set(call);
      else this.course.set(data);
    } catch {
      this.error.set({ status: 0, message: 'Network error' } as ApiCallResult);
    } finally {
      this.loading.set(false);
    }
  }

  cohort(c: CourseDetail): CohortBlock | null {
    return c.anchor_cohort ?? c.cohorts?.[0] ?? null;
  }

  visibleUnits(c: CourseDetail): CourseUnit[] {
    const all = c.units ?? [];
    return this.showAllUnits() ? all : all.slice(0, 3);
  }

  seatsPct(co: CohortBlock): number {
    if (!co.capacity) return 0;
    const left = co.seats_left ?? 0;
    return Math.round(((co.capacity - left) / co.capacity) * 100);
  }

  ratingText(c: CourseDetail): string {
    const avg = c.rating?.avg ?? 0;
    return avg > 0 ? avg.toFixed(1) : '---';
  }

  typeText(c: CourseDetail): string {
    const t = c.course_type || '';
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Online';
  }

  unitType(u: CourseUnit): string {
    const t = (u.type || 'Video').toLowerCase();
    if (t.includes('session') || t.includes('live')) return 'Session';
    if (t.includes('doc') || t.includes('pdf') || t.includes('file')) return 'Document';
    return 'Video';
  }

  duration(u: CourseUnit): string {
    return u.duration_minutes ? `${u.duration_minutes} min` : '—';
  }

  ctaEnabled(c: CourseDetail): boolean {
    return c.cta?.enabled ?? false;
  }

  ctaLabel(c: CourseDetail): string {
    const state = c.cta?.state || '';
    const map: Record<string, string> = {
      enrol: 'Request Enrolment',
      request_enrolment: 'Request Enrolment',
      enrolled: 'Already Enrolled',
      pending: 'Request Pending',
      full: 'Cohort Full',
      closed: 'Enrolment Closed',
      get_notified: 'Get Notified',
      unavailable: 'Unavailable',
    };
    return map[state] || 'Request Enrolment';
  }

  initials(name?: string | null): string {
    if (!name) return '–';
    return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  }

  pad(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
  }

  shortDate(d?: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  longDate(d?: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
