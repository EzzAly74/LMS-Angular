import { ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MobileDataService } from '../mobile-data.service';
import { ActiveCourse, AttendanceSession, CertificateCard, MyLearningOverview, QualificationProgress } from '../mobile.models';
import { ApiCallResult } from '../../core/mobile-api.service';
import { CourseCoverComponent } from '../ui/course-cover.component';

type Sheet = 'none' | 'attendance' | 'present' | 'rating';

/** S-05 — Profile · My Learning, plus the attendance / mark-present / rating sheets. */
@Component({
  selector: 'sbx-my-learning-screen',
  standalone: true,
  imports: [CommonModule, CourseCoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (banner()) {
      <div class="ml-banner">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#0e8c4f"/><path d="m7.5 12 3 3 6-7" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        {{ banner() }}
      </div>
    }

    <div class="ml">
      @if (loading()) {
        <div class="skel skel--lg"></div><div class="skel"></div><div class="skel"></div>
      } @else if (error()) {
        <div class="msg msg--err"><strong>{{ error()?.status }}</strong> {{ error()?.message }}</div>
      } @else {
        <!-- Active courses -->
        <div class="ml__label">ACTIVE COURSES</div>
        @for (c of active(); track c.id) {
          <div class="acard">
            @if (c.live_session) {
              <div class="acard__live"><i></i> Live Now · {{ liveWhen(c) }}</div>
            }
            <div class="acard__head">
              <sbx-course-cover [image]="c.image" [seed]="c.id" [size]="44" [radius]="10" />
              <div class="acard__txt">
                <div class="acard__t">{{ c.title }}</div>
                <div class="acard__s">
                  Session {{ c.progress?.past_sessions || 0 }}
                  @if ((c.progress?.absences || 0) > 0) {
                    <span class="pill pill--red">{{ c.progress?.absences }} Absence</span>
                  }
                </div>
                @if (!c.live_session) {
                  <button class="acard__rate" type="button" (click)="openRating(c)">
                    <svg viewBox="0 0 24 24" fill="#f5a623"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8-4.3-4.1 5.9-.9L12 3Z"/></svg>
                    Rate your experience
                  </button>
                }
              </div>
            </div>
            <div class="acard__actions">
              @if (c.live_session) {
                <button class="iconbtn" type="button" (click)="openAttendance(c)" aria-label="View attendance">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="#0c2427" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="#0c2427" stroke-width="1.6"/></svg>
                </button>
                <button class="btn btn--dark" type="button" (click)="openPresent(c)">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="1.6"/><path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Mark Present
                </button>
              } @else {
                <button class="btn btn--ghost" type="button" (click)="openAttendance(c)">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="#0c2427" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="#0c2427" stroke-width="1.6"/></svg>
                  View Attendance
                </button>
              }
            </div>
          </div>
        }
        @if (active().length === 0) { <div class="msg">No active courses.</div> }

        <!-- Qualifications -->
        @if (quals().length) {
          <div class="ml__label">MY QUALIFICATIONS</div>
          <div class="ml__labelsub">Required for your role</div>
          <div class="quals">
            @for (q of quals(); track q.id) {
              <div class="qrow">
                <div class="qrow__head">
                  <span class="qrow__name">{{ q.name }}</span>
                  <span class="qrow__pct" [class.is-full]="q.percent >= 100">{{ q.percent }}%</span>
                </div>
                <div class="qbar"><i [class.is-full]="q.percent >= 100" [style.width.%]="q.percent"></i></div>
              </div>
            }
          </div>
          @if (counts().qualifications > quals().length) {
            <button class="seeall" type="button">See all {{ counts().qualifications }} qualifications</button>
          }
        }

        <!-- Certificates -->
        @if (certs().length) {
          <div class="ml__label">MY CERTIFICATES</div>
          <div class="certs">
            @for (ct of certs(); track ct.id) {
              <div class="cert">
                <div class="cert__thumb"></div>
                <div class="cert__txt">
                  <div class="cert__t">{{ ct.course_title }}</div>
                  <div class="cert__s">Issued {{ longDate(ct.issued_date || ct.issued_at) }}</div>
                  @if (ct.user_rating != null) {
                    <div class="cert__rate">{{ sentiment(ct.user_rating) }} <svg viewBox="0 0 24 24" fill="#f5a623"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8-4.3-4.1 5.9-.9L12 3Z"/></svg> {{ ct.user_rating.toFixed(1) }}</div>
                  }
                </div>
                <button class="cert__add" type="button" aria-label="Open"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#0c2427" stroke-width="1.5"/><path d="M12 8v8m-4-4h8" stroke="#0c2427" stroke-width="1.5" stroke-linecap="round"/></svg></button>
              </div>
            }
          </div>
          @if (counts().certificates > certs().length) {
            <button class="seeall" type="button">See all {{ counts().certificates }} certificates</button>
          }
        }
        <div style="height: 8px"></div>
      }
    </div>

    <!-- ───────────── Bottom sheets ───────────── -->
    @if (sheet() !== 'none') {
      <div class="scrim" (click)="closeSheet()"></div>

      <!-- Attendance -->
      @if (sheet() === 'attendance') {
        <div class="sheet">
          <div class="sheet__head">
            <span class="sheet__title"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="#0c2427" stroke-width="1.6"/><path d="M5 12a7 7 0 0 1 14 0M3 12a9 9 0 0 1 18 0" stroke="#0c2427" stroke-width="1.6" stroke-linecap="round"/></svg> Attendance:</span>
            <button class="sheet__x" type="button" (click)="closeSheet()">✕</button>
          </div>
          @if (sessionsLoading()) {
            @for (s of [1,2,3]; track s) { <div class="srow"><span class="skel skel--row"></span></div> }
          } @else {
            <div class="slist">
              @for (s of sessions(); track s.id; let i = $index) {
                <div class="srow">
                  <span>{{ s.title || ('Session ' + (i + 1)) }}</span>
                  <span class="pill" [class.pill--green]="s.attended" [class.pill--red]="!s.attended">{{ s.attended ? 'Attended' : 'Absent' }}</span>
                </div>
              }
              @if (sessions().length === 0) { <div class="msg">No sessions recorded.</div> }
            </div>
          }
        </div>
      }

      <!-- Mark present (passcode) -->
      @if (sheet() === 'present') {
        <div class="sheet">
          <div class="sheet__grip"></div>
          <div class="sheet__head">
            <span class="sheet__title">Request enrolment?</span>
            <button class="sheet__x" type="button" (click)="closeSheet()">✕</button>
          </div>
          @if (current(); as c) {
            <div class="presentcard">
              <sbx-course-cover [image]="c.image" [seed]="c.id" [size]="40" [radius]="10" />
              <div>
                <div class="presentcard__t">{{ c.title }}</div>
                <div class="presentcard__s">Session {{ c.progress?.past_sessions || 0 }} · {{ liveWhen(c) }}</div>
              </div>
            </div>
          }
          <div class="otp-label">Enter the code shown by your instructor</div>
          <div class="otp">
            @for (i of [0,1,2,3,4]; track i) {
              <div class="otp__box" [class.is-active]="code().length === i">{{ code()[i] || '' }}</div>
            }
          </div>
          @if (markError()) { <div class="otp-err">{{ markError() }}</div> }
          <div class="keypad">
            @for (k of ['1','2','3','4','5','6','7','8','9']; track k) {
              <button type="button" class="key" (click)="press(k)">{{ k }}</button>
            }
            <button type="button" class="key key--alt" (click)="backspace()">⌫</button>
            <button type="button" class="key" (click)="press('0')">0</button>
            <button type="button" class="key key--alt" [disabled]="code().length < 5 || marking()" (click)="submitPresent()">✓</button>
          </div>
        </div>
      }

      <!-- Rating -->
      @if (sheet() === 'rating') {
        <div class="sheet sheet--rating">
          <div class="sheet__head">
            <span class="sheet__title">Your Feedback</span>
            <button class="sheet__x" type="button" (click)="closeSheet()">✕</button>
          </div>
          <div class="rating-q">Share your thoughts on the course material, structure, or instructor</div>
          <div class="faces">
            @for (f of faces; track f.value) {
              <button type="button" class="face" [class.is-on]="ratingValue() === f.value" (click)="ratingValue.set(f.value)">{{ f.emoji }}</button>
            }
          </div>
          @if (markError()) { <div class="otp-err">{{ markError() }}</div> }
          <button type="button" class="rating-submit" [disabled]="ratingValue() === 0 || marking()" (click)="submitRating()">Submit</button>
        </div>
      }
    }
  `,
  styles: [
    `
      :host { display: block; height: 100%; position: relative; }
      .ml { padding: 4px 24px 12px; display: flex; flex-direction: column; }
      .ml__label { font-size: 11px; font-weight: 600; letter-spacing: .06em; color: #8a8f98; margin: 16px 0 8px; }
      .ml__labelsub { font-size: 12px; color: #595959; margin: -6px 0 10px; }

      .acard { border: 1px solid #e6e7e8; border-radius: 14px; padding: 12px; margin-bottom: 12px; box-shadow: 0 1px 1px rgba(0,0,0,.05); }
      .acard__live { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #0e8c4f; margin-bottom: 8px; }
      .acard__live i { width: 7px; height: 7px; border-radius: 50%; background: #0e8c4f; }
      .acard__head { display: flex; gap: 10px; }
      .acard__txt { flex: 1; min-width: 0; }
      .acard__t { font-size: 15px; font-weight: 700; color: #171819; line-height: 1.2; }
      .acard__s { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #595959; margin-top: 3px; }
      .acard__rate { display: flex; align-items: center; gap: 4px; background: none; border: 0; padding: 6px 0 0; font-family: inherit; font-size: 12px; font-weight: 600; color: #171819; text-decoration: underline; cursor: pointer; }
      .acard__rate svg { width: 14px; height: 14px; }
      .acard__actions { display: flex; gap: 10px; margin-top: 12px; }
      .pill { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 8px; }
      .pill--red { background: #fdecec; color: #e5484d; }
      .pill--green { background: #e7f6ee; color: #0e8c4f; }

      .iconbtn { width: 48px; height: 44px; border: 1px solid #e6e7e8; border-radius: 12px; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .iconbtn svg { width: 20px; height: 20px; }
      .btn { flex: 1; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
      .btn svg { width: 18px; height: 18px; }
      .btn--dark { background: #0c2427; color: #fff; border: 0; }
      .btn--ghost { background: #fff; color: #0c2427; border: 1px solid #cfd0d1; }

      .quals { display: flex; flex-direction: column; gap: 12px; }
      .qrow__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
      .qrow__name { font-size: 14px; font-weight: 600; color: #171819; }
      .qrow__pct { font-size: 13px; font-weight: 600; color: #171819; }
      .qrow__pct.is-full { color: #0e8c4f; }
      .qbar { height: 7px; background: #eef0f0; border-radius: 7px; overflow: hidden; }
      .qbar i { display: block; height: 100%; background: linear-gradient(90deg,#0c2427,#3fb6a8); border-radius: 7px; }
      .qbar i.is-full { background: #0e8c4f; }
      .seeall { margin-top: 10px; width: 100%; border: 1px solid #e6e7e8; background: #fff; border-radius: 12px; padding: 12px; font-family: inherit; font-size: 13px; font-weight: 600; color: #171819; cursor: pointer; }

      .certs { display: flex; flex-direction: column; gap: 10px; }
      .cert { display: flex; gap: 12px; align-items: center; border: 1px solid #e6e7e8; border-radius: 14px; padding: 12px; }
      .cert__thumb { width: 56px; height: 44px; border-radius: 8px; background: #e9ebed; flex: none; }
      .cert__txt { flex: 1; min-width: 0; }
      .cert__t { font-size: 14px; font-weight: 700; color: #171819; line-height: 1.2; }
      .cert__s { font-size: 12px; color: #595959; margin-top: 2px; }
      .cert__rate { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #595959; margin-top: 3px; }
      .cert__rate svg { width: 13px; height: 13px; }
      .cert__add { background: none; border: 0; cursor: pointer; }
      .cert__add svg { width: 22px; height: 22px; }

      /* Sheets */
      .scrim { position: absolute; inset: 0; background: rgba(12,36,39,.35); z-index: 5; }
      .sheet {
        position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; background: #fff;
        border-top-left-radius: 20px; border-top-right-radius: 20px; padding: 16px 20px 28px;
        max-height: 80%; overflow-y: auto; box-shadow: 0 -8px 30px rgba(12,36,39,.18);
      }
      .sheet__grip { width: 44px; height: 4px; border-radius: 4px; background: #0c2427; margin: 0 auto 12px; }
      .sheet__head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #f0f0f0; }
      .sheet__title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #171819; }
      .sheet__title svg { width: 20px; height: 20px; }
      .sheet__x { background: none; border: 0; font-size: 16px; color: #8a8f98; cursor: pointer; }

      .slist { padding-top: 4px; }
      .srow { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #171819; }

      .presentcard { display: flex; gap: 10px; align-items: center; background: #f7f8f8; border-radius: 12px; padding: 12px; margin: 14px 0; }
      .presentcard__t { font-size: 14px; font-weight: 700; color: #171819; }
      .presentcard__s { font-size: 12px; color: #595959; margin-top: 2px; }
      .otp-label { text-align: center; font-size: 12px; color: #595959; margin-bottom: 10px; }
      .otp { display: flex; gap: 10px; justify-content: center; margin-bottom: 8px; }
      .otp__box { width: 52px; height: 60px; border: 1px solid #cfd0d1; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 600; color: #171819; }
      .otp__box.is-active { border-color: #0c2427; box-shadow: 0 0 0 1px #0c2427; }
      .otp-err { text-align: center; color: #e5484d; font-size: 12px; margin: 4px 0 8px; }
      .keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
      .key { height: 54px; border: 1px solid #ececec; border-radius: 12px; background: #fff; font-family: inherit; font-size: 20px; font-weight: 600; color: #171819; cursor: pointer; }
      .key--alt { background: #f3f4f6; }
      .key:disabled { opacity: .4; cursor: not-allowed; }

      .sheet--rating { text-align: left; }
      .rating-q { font-size: 16px; font-weight: 700; color: #171819; margin: 14px 0 16px; line-height: 1.3; }
      .faces { display: flex; justify-content: space-between; margin-bottom: 18px; }
      .face { width: 48px; height: 48px; border-radius: 50%; border: 0; background: #f3f4f6; font-size: 24px; cursor: pointer; transition: transform .1s; }
      .face.is-on { background: #fff3d6; transform: scale(1.12); box-shadow: 0 0 0 2px #f5a623; }
      .rating-submit { width: 100%; height: 50px; border: 0; border-radius: 12px; background: #e9ebed; color: #9aa0a6; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
      .rating-submit:not(:disabled) { background: #0c2427; color: #fff; }

      .skel { height: 84px; border-radius: 14px; background: linear-gradient(90deg,#eee,#f6f6f6,#eee); background-size: 200% 100%; animation: sh 1.2s infinite; margin-bottom: 12px; }
      .skel--lg { height: 120px; }
      .skel--row { height: 18px; width: 100%; display: block; }
      @keyframes sh { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      .msg { padding: 16px; border-radius: 12px; background: #f5f5f5; color: #595959; font-size: 13px; text-align: center; }
      .msg--err { background: #fdecec; color: #c0392b; }
      .ml-banner { display: flex; align-items: center; gap: 8px; background: #f7f8f8; color: #171819; font-size: 13px; padding: 12px 24px; }
      .ml-banner svg { width: 20px; height: 20px; }
    `,
  ],
})
export class MyLearningScreenComponent implements OnInit {
  @Output() apiResult = new EventEmitter<ApiCallResult>();

  private readonly data = inject(MobileDataService);

  readonly active = signal<ActiveCourse[]>([]);
  readonly quals = signal<QualificationProgress[]>([]);
  readonly certs = signal<CertificateCard[]>([]);
  readonly counts = signal<MyLearningOverview['counts']>({ active_courses: 0, qualifications: 0, certificates: 0 });
  readonly loading = signal(false);
  readonly error = signal<ApiCallResult | null>(null);
  readonly banner = signal<string | null>(null);

  readonly sheet = signal<Sheet>('none');
  readonly current = signal<ActiveCourse | null>(null);
  readonly sessions = signal<AttendanceSession[]>([]);
  readonly sessionsLoading = signal(false);
  readonly code = signal('');
  readonly marking = signal(false);
  readonly markError = signal<string | null>(null);
  readonly ratingValue = signal(0);

  readonly faces = [
    { value: 1, emoji: '😔' },
    { value: 2, emoji: '😕' },
    { value: 3, emoji: '😐' },
    { value: 4, emoji: '🙂' },
    { value: 5, emoji: '😄' },
  ];

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const { data, call } = await this.data.myOverview();
      this.apiResult.emit(call);
      if (!call.ok) {
        this.error.set(call);
        return;
      }
      this.active.set(data?.previews?.active_courses ?? []);
      this.quals.set(data?.previews?.qualifications ?? []);
      this.certs.set(data?.previews?.certificates ?? []);
      this.counts.set(data?.counts ?? { active_courses: 0, qualifications: 0, certificates: 0 });
    } catch {
      this.error.set({ status: 0, message: 'Network error' } as ApiCallResult);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Attendance sheet ──
  async openAttendance(c: ActiveCourse): Promise<void> {
    this.current.set(c);
    this.sessions.set([]);
    this.sheet.set('attendance');
    this.sessionsLoading.set(true);
    try {
      const { data, call } = await this.data.sessions(c.id);
      this.apiResult.emit(call);
      this.sessions.set(call.ok && Array.isArray(data) ? data : []);
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  // ── Mark present sheet ──
  openPresent(c: ActiveCourse): void {
    this.current.set(c);
    this.code.set('');
    this.markError.set(null);
    this.sheet.set('present');
  }

  press(d: string): void {
    if (this.code().length >= 5) return;
    this.code.set(this.code() + d);
    this.markError.set(null);
  }

  backspace(): void {
    this.code.set(this.code().slice(0, -1));
  }

  async submitPresent(): Promise<void> {
    const c = this.current();
    if (!c || this.code().length < 5) return;
    this.marking.set(true);
    this.markError.set(null);
    try {
      const { call } = await this.data.markAttendance({
        course_id: c.id,
        session_id: c.live_session?.id,
        passcode: this.code(),
      });
      this.apiResult.emit(call);
      if (call.ok) {
        this.closeSheet();
        this.banner.set('You have been marked as present for this session.');
        void this.load();
      } else {
        this.markError.set(call.message || 'Invalid or expired code.');
      }
    } finally {
      this.marking.set(false);
    }
  }

  // ── Rating sheet ──
  openRating(c: ActiveCourse): void {
    this.current.set(c);
    this.ratingValue.set(0);
    this.markError.set(null);
    this.sheet.set('rating');
  }

  async submitRating(): Promise<void> {
    const c = this.current();
    if (!c || this.ratingValue() === 0) return;
    this.marking.set(true);
    this.markError.set(null);
    try {
      const { call } = await this.data.rate(c.id, { rating: this.ratingValue() });
      this.apiResult.emit(call);
      if (call.ok) {
        this.closeSheet();
        this.banner.set('Thanks! Your feedback has been recorded.');
      } else {
        this.markError.set(call.message || 'Could not submit rating.');
      }
    } finally {
      this.marking.set(false);
    }
  }

  closeSheet(): void {
    this.sheet.set('none');
  }

  liveWhen(c: ActiveCourse): string {
    const ls = c.live_session;
    if (!ls) return 'Today';
    const t = ls.time_from ? this.fmtTime(ls.time_from) : '';
    return `Today${t ? ', ' + t : ''}`;
  }

  private fmtTime(t: string): string {
    const m = /^(\d{1,2}):(\d{2})/.exec(t);
    if (!m) return t;
    let h = parseInt(m[1], 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m[2]} ${ampm}`;
  }

  sentiment(r: number): string {
    if (r >= 4) return 'Satisfied';
    if (r >= 3) return 'Neutral';
    return 'Dissatisfied';
  }

  longDate(d?: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
