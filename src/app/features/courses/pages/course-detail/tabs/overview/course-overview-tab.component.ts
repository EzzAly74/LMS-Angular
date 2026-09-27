import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { NasDatePipe } from '../../../../../../shared/pipes/nas-date.pipes';
import { CoursesApiService } from '../../../../services/courses-api.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { EnumsService } from '../../../../../../core/services/enums.service';
import { LocaleService } from '../../../../../../core/services/locale.service';
import { pluralKey } from '../../../../../../core/utils/plural-key';
import { withLocaleReload } from '../../../../../../core/utils/with-locale-reload';
import type { CourseDetail } from '../../../../../../core/models/course.types';
import type { CourseEvaluationSummary } from '../../../../models/course-detail.model';

/**
 * Course Details - Overview tab (Figma 2266:128869): about, what learners
 * will learn, requirements, the "Learner Evaluations" histogram, and the
 * Course Settings card with the course image (Figma note on the grey square:
 * "Image"). The histogram needs the evaluation permission; without it the
 * card is left out rather than shown empty.
 */
@Component({
  selector: 'app-course-overview-tab',
  standalone: true,
  imports: [TranslateModule, NasDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-overview-tab.component.html',
  styleUrl: './course-overview-tab.component.scss',
})
export class CourseOverviewTabComponent implements OnInit {
  private readonly api = inject(CoursesApiService);
  private readonly auth = inject(AuthService);
  private readonly enums = inject(EnumsService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = inject(LocaleService).locale;

  readonly course = input.required<CourseDetail>();

  readonly canSeeEvaluations = computed(() => this.auth.hasView('view-evaluations'));
  readonly evaluation = signal<CourseEvaluationSummary | null>(null);
  readonly evaluationFailed = signal(false);

  readonly deliveryLabel = computed(() => this.enumLabel('course_type', this.course().type));
  readonly levelLabel = computed(() => this.enumLabel('course_level', this.course().level ?? undefined));

  /** Each star row as a share of all reviews, as drawn (24 of 58 = 41 %). */
  readonly bars = computed(() => {
    const e = this.evaluation();
    const total = e?.reviews ?? 0;
    return (e?.distribution ?? []).map(b => ({ ...b, pct: total > 0 ? Math.round((b.count / total) * 100) : 0 }));
  });

  constructor() {
    withLocaleReload(() => this.loadEvaluation());
  }

  ngOnInit(): void {
    this.loadEvaluation();
  }

  loadEvaluation(): void {
    if (!this.canSeeEvaluations()) return;
    this.evaluationFailed.set(false);
    this.api
      .evaluationSummary(this.course().id)
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        if (res) this.evaluation.set(res.result);
        else this.evaluationFailed.set(true);
      });
  }

  reviewsKey(n: number): string {
    return pluralKey('course_detail.out_of_reviews', n, this.locale());
  }

  learnersKey(n: number): string {
    return pluralKey('course_detail.n_learners', n, this.locale());
  }

  private enumLabel(name: 'course_type' | 'course_level', code: string | undefined): string {
    if (!code) return '-';
    return this.enums.options(name)().find(o => o.code === code)?.value ?? '-';
  }
}
