import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { NasStatusBadgeComponent } from '../../../../shared/nas/nas-status-badge.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface QuizAttemptRaw {
  id: number;
  user?: { id: number; name: string };
  course?: { id: number; title: string };
  score: number;
  status: 'passed' | 'failed' | 'pending';
  created_at: string;
}

interface QuizAttempt {
  id: number;
  user_name: string;
  course_title: string;
  score: number;
  max_score?: number;
  status: 'passed' | 'failed' | 'pending';
  created_at: string;
  course_id?: number;
}

interface CourseOption {
  id: number;
  title: string;
}

@Component({
  selector: 'app-quizzes-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, DropdownModule, SkeletonModule, FormsModule, NasPageHeaderComponent, NasStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quizzes-list.component.html',
  styleUrl: './quizzes-list.component.scss',
})
export class QuizzesListComponent implements OnInit {
  private api = inject(ApiService);

  constructor() {
    withLocaleReload(() => {
      this.load();
      this.loadCourseOptions();
    });
  }

  items         = signal<QuizAttempt[]>([]);
  total         = signal(0);
  loading       = signal(true);
  courseOptions = signal<CourseOption[]>([]);

  perPage          = 20;
  page             = 1;
  search           = '';
  selectedCourseId: number | null = null;

  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min = Math.min;

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
    this.loadCourseOptions();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<QuizAttemptRaw>(API.QUIZZES, {
      page: this.page,
      per_page: this.perPage,
      search: this.search || undefined,
      course_id: this.selectedCourseId ?? undefined,
    }).subscribe({
      next:  res => {
        this.items.set(res.result.data.map(q => this.mapAttempt(q)));
        this.total.set(res.result.total);
        this.loading.set(false);
      },
      error: ()  => this.loading.set(false),
    });
  }

  private mapAttempt(r: QuizAttemptRaw): QuizAttempt {
    return {
      id:           r.id,
      user_name:    r.user?.name ?? '—',
      course_title: r.course?.title ?? '—',
      score:        r.score,
      status:       r.status,
      created_at:   r.created_at,
      course_id:    r.course?.id,
    };
  }

  loadCourseOptions(): void {
    this.api.getPaginated<CourseOption>(API.COURSES, { per_page: 200 })
      .subscribe({ next: res => this.courseOptions.set(res.result.data) });
  }

  onPage(p: number): void {
    this.page = p;
    this.load();
  }

  onSearch(term: string): void {
    this.search$.next(term);
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }
}
