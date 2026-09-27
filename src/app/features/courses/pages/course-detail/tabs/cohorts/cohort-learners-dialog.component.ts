import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { PrimeTemplate } from 'primeng/api';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, map } from 'rxjs';
import { NasIconComponent } from '../../../../../../shared/nas';
import { CoursesApiService } from '../../../../services/courses-api.service';
import type { CourseLearnerRow } from '../../../../models/course-detail.model';

const PER_PAGE = 50;

interface Load {
  search: string;
  page: number;
}

/**
 * Cohort learners - Figma 2276:133999: the cohort's name, a quick search and
 * a read-only, scrolling list of its learners, then Done. Opened from the
 * cohort row's "Enrolled / Capacity" link. Paged by 50 with "Show more"
 * (capacity is up to 10,000). Focus returns to the link on close.
 */
@Component({
  selector: 'app-cohort-learners-dialog',
  standalone: true,
  imports: [FormsModule, TranslateModule, DialogModule, PrimeTemplate, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cohort-learners-dialog.component.html',
  styleUrl: './cohort-learners-dialog.component.scss',
})
export class CohortLearnersDialogComponent {
  private readonly api = inject(CoursesApiService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = model(false);
  readonly courseId = input.required<number>();
  readonly cohortId = input<number | null>(null);
  readonly cohortName = input('');

  readonly rows = signal<CourseLearnerRow[]>([]);
  readonly total = signal(0);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly search = signal('');
  private page = 1;
  private opener: HTMLElement | null = null;

  private readonly search$ = new Subject<string>();
  private readonly load$ = new Subject<Load>();

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(s => this.fetch(s.trim(), 1));

    this.load$
      .pipe(
        switchMap(q => {
          const id = this.cohortId();
          if (id === null) return of({ ok: true as const, q, data: [] as CourseLearnerRow[], total: 0 });
          return this.api
            .listLearners(this.courseId(), { group_id: id, search: q.search || undefined, page: q.page, per_page: PER_PAGE })
            .pipe(
              map(res => ({ ok: true as const, q, data: res.result.data, total: res.result.total })),
              catchError(() => of({ ok: false as const, q })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(out => {
        if (!out.ok) {
          this.state.set('error');
          return;
        }
        this.rows.set(out.q.page === 1 ? out.data : [...this.rows(), ...out.data]);
        this.total.set(out.total);
        this.state.set('ready');
      });

    // Each opening starts fresh for the chosen cohort.
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        const active = this.document.activeElement;
        this.opener ??= active instanceof HTMLElement ? active : null;
        this.search.set('');
        this.fetch('', 1);
      });
    }, { allowSignalWrites: true });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.search$.next(value);
  }

  more(): void {
    this.fetch(this.search().trim(), this.page + 1);
  }

  retry(): void {
    this.fetch(this.search().trim(), this.page);
  }

  restoreFocus(): void {
    this.opener?.focus();
    this.opener = null;
  }

  private fetch(search: string, page: number): void {
    this.page = page;
    if (page === 1) this.state.set('loading');
    this.load$.next({ search, page });
  }
}
