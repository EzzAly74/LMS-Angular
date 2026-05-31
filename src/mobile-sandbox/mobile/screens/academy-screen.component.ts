import { ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MobileDataService } from '../mobile-data.service';
import { CourseCard, ScopeChip } from '../mobile.models';
import { ApiCallResult } from '../../core/mobile-api.service';
import { CourseCoverComponent } from '../ui/course-cover.component';

/** S-02 — Academy / Available courses feed. */
@Component({
  selector: 'sbx-academy-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, CourseCoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ac">
      <!-- Search -->
      <div class="ac__search">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#b8b9ba" stroke-width="1.8"/><path d="m20 20-3-3" stroke="#b8b9ba" stroke-width="1.8" stroke-linecap="round"/></svg>
        <input
          type="text"
          placeholder="Search courses..."
          [(ngModel)]="search"
          (keyup.enter)="reload()" />
      </div>

      <!-- Scope chips: All / Special / General -->
      <div class="ac__chips">
        @for (chip of chips(); track chip.key) {
          <button
            type="button"
            class="chip"
            [class.chip--active]="isActive(chip)"
            (click)="selectChip(chip)">
            {{ chip.label }}
            <span class="chip__count">{{ chip.count }}</span>
          </button>
        }
      </div>

      <!-- Continue learning strip -->
      <div class="ac__continue">
        <div>
          <div class="ac__continue-t">Continue Learning</div>
          <div class="ac__continue-s">{{ inProgress() }} courses in progress</div>
        </div>
        <button type="button" class="ac__golink" (click)="goLearning.emit()">
          Go to My Learning
          <svg viewBox="0 0 16 16" fill="none"><path d="M5 11 11 5M6 5h5v5" stroke="#0c2427" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <!-- States -->
      @if (loading()) {
        <div class="ac__list">
          @for (s of [1,2,3,4]; track s) { <div class="skel"></div> }
        </div>
      } @else if (error()) {
        <div class="ac__msg ac__msg--err">
          <strong>{{ error()?.status }}</strong> {{ error()?.message || 'Request failed' }}
        </div>
      } @else if (courses().length === 0) {
        <div class="ac__msg">{{ emptyText() }}</div>
      } @else {
        <div class="ac__list">
          @for (c of courses(); track c.id) {
            <button type="button" class="card" (click)="openCourse.emit(c.id)">
              <sbx-course-cover [image]="c.image" [seed]="c.id" [size]="64" />
              <div class="card__body">
                <div class="card__title">{{ c.title }}</div>
                <div class="card__meta">
                  <span>{{ c.category?.name || '—' }}</span>
                  <i class="dot"></i>
                  <span class="card__qual">{{ firstQual(c) }}</span>
                  @if (extraQuals(c) > 0) { <span class="card__plus">+{{ extraQuals(c) }}</span> }
                </div>
                <div class="card__foot">
                  <span class="rate">
                    <svg viewBox="0 0 24 24" fill="#f5a623"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8-4.3-4.1 5.9-.9L12 3Z"/></svg>
                    {{ ratingText(c) }}
                  </span>
                  <span class="meta-i">
                    <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="16" rx="2" stroke="#595959" stroke-width="1.6"/><path d="M4 9h16M8 3v3m8-3v3" stroke="#595959" stroke-width="1.6" stroke-linecap="round"/></svg>
                    {{ shortDate(c.next_cohort?.start_date) }}
                  </span>
                  <span class="meta-i">
                    <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="#595959" stroke-width="1.6"/><path d="M12 9v6m-3-3h6" stroke="#595959" stroke-width="1.6" stroke-linecap="round"/></svg>
                    {{ typeText(c) }}
                  </span>
                </div>
              </div>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .ac { display: flex; flex-direction: column; gap: 16px; padding: 4px 0 12px; }
      .ac__search {
        margin: 0 24px; height: 40px; display: flex; align-items: center; gap: 10px; padding: 0 14px;
        border: 1px solid #cfd0d1; border-radius: 24px;
      }
      .ac__search svg { width: 18px; height: 18px; flex: none; }
      .ac__search input { border: 0; outline: 0; flex: 1; font-size: 12px; font-family: inherit; color: #171819; background: none; }
      .ac__search input::placeholder { color: #b8b9ba; }

      .ac__chips { display: flex; gap: 8px; overflow-x: auto; padding: 0 24px; }
      .ac__chips::-webkit-scrollbar { display: none; }
      .chip {
        flex: none; display: flex; align-items: center; gap: 8px; padding: 4px 16px; border-radius: 16px;
        border: 1px solid #cfd0d1; background: #fdfdfd; font-size: 14px; color: #adadae; font-weight: 500;
        cursor: pointer; font-family: inherit;
      }
      .chip--active { border-color: #0c2427; background: #f2fbfa; color: #0c2427; }
      .chip__count { background: #fdfdfd; border-radius: 50px; padding: 0 6px; font-size: 13px; font-weight: 400; }
      .chip--active .chip__count { background: #f2fbfa; }

      .ac__continue {
        background: #f5f5f5; padding: 8px 24px; display: flex; align-items: center; justify-content: space-between;
      }
      .ac__continue-t { font-size: 14px; font-weight: 500; color: #171819; }
      .ac__continue-s { font-size: 12px; color: #595959; }
      .ac__golink { display: flex; align-items: center; gap: 4px; background: none; border: 0; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 500; color: #0c2427; text-decoration: underline; }
      .ac__golink svg { width: 15px; height: 15px; }

      .ac__list { display: flex; flex-direction: column; gap: 12px; padding: 0 24px; }
      .card {
        display: flex; gap: 12px; align-items: flex-start; text-align: left; padding: 15px;
        background: #fff; border: 1px solid #e6e7e8; border-radius: 14px; cursor: pointer;
        box-shadow: 0 1px 1px rgba(0,0,0,.06); font-family: inherit;
      }
      .card__body { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
      .card__title { font-weight: 700; font-size: 15px; color: #171819; letter-spacing: -.3px; line-height: 1.25; }
      .card__meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #676e76; flex-wrap: wrap; }
      .card__meta .dot { width: 3px; height: 3px; border-radius: 2px; background: #cfd0d1; }
      .card__plus { background: rgba(0,0,136,.1); color: #008; border-radius: 16px; padding: 0 5px; font-size: 11px; }
      .card__foot { display: flex; align-items: center; gap: 14px; font-size: 12px; color: #595959; }
      .rate { display: flex; align-items: center; gap: 3px; font-weight: 600; color: #171819; }
      .rate svg { width: 15px; height: 15px; }
      .meta-i { display: flex; align-items: center; gap: 3px; }
      .meta-i svg { width: 13px; height: 13px; }

      .skel { height: 96px; border-radius: 14px; background: linear-gradient(90deg,#eee,#f6f6f6,#eee); background-size: 200% 100%; animation: sh 1.2s infinite; }
      @keyframes sh { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      .ac__msg { margin: 8px 24px; padding: 16px; border-radius: 12px; background: #f5f5f5; color: #595959; font-size: 13px; text-align: center; }
      .ac__msg--err { background: #fdecec; color: #c0392b; }
    `,
  ],
})
export class AcademyScreenComponent implements OnInit {
  @Output() openCourse = new EventEmitter<number>();
  @Output() goLearning = new EventEmitter<void>();
  @Output() apiResult = new EventEmitter<ApiCallResult>();

  private readonly data = inject(MobileDataService);

  readonly chips = signal<ScopeChip[]>([]);
  readonly courses = signal<CourseCard[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiCallResult | null>(null);
  readonly inProgress = signal(0);

  search = '';
  private activeScope: ScopeChip['key'] = 'all';

  ngOnInit(): void {
    void this.loadChips();
    void this.reload();
  }

  async loadChips(): Promise<void> {
    try {
      const { data, call } = await this.data.scopes();
      this.apiResult.emit(call);
      if (call.ok && Array.isArray(data)) this.chips.set(data);
    } catch {
      /* surfaced via reload error */
    }
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const inputs: Record<string, string | number> = { per_page: 20 };
      if (this.activeScope !== 'all') inputs['scope'] = this.activeScope;
      if (this.search.trim()) inputs['search'] = this.search.trim();
      const { data, call } = await this.data.courses(inputs);
      this.apiResult.emit(call);
      if (!call.ok) {
        this.error.set(call);
        this.courses.set([]);
      } else {
        this.courses.set(Array.isArray(data) ? data : []);
      }
    } catch {
      this.error.set({ status: 0, message: 'Network error' } as ApiCallResult);
    } finally {
      this.loading.set(false);
    }
  }

  emptyText(): string {
    switch (this.activeScope) {
      case 'special':
        return 'No special courses linked to your qualifications right now.';
      case 'general':
        return 'No general courses are open for enrolment right now.';
      default:
        return 'No available courses for this learner.';
    }
  }

  isActive(chip: ScopeChip): boolean {
    return this.activeScope === chip.key;
  }

  selectChip(chip: ScopeChip): void {
    this.activeScope = chip.key;
    void this.reload();
  }

  firstQual(c: CourseCard): string {
    return c.qualifications?.[0]?.name || 'Qualifications';
  }

  extraQuals(c: CourseCard): number {
    return Math.max(0, (c.qualifications?.length ?? 0) - 1);
  }

  ratingText(c: CourseCard): string {
    const avg = c.rating?.avg ?? 0;
    return avg > 0 ? avg.toFixed(1) : '---';
  }

  typeText(c: CourseCard): string {
    const t = c.course_type || '';
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Online';
  }

  shortDate(d?: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
}
