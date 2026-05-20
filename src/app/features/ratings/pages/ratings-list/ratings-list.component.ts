import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

interface RatingRaw {
  id: number;
  rating: number;
  review?: string;
  user?: { id: number; name: string; machine_code?: string };
  course?: { id: number; title: string };
  course_id?: number;
  created_at: string;
}

interface Rating {
  id: number;
  user_name: string;
  course_title: string;
  rating: number;
  comment?: string;
  created_at: string;
  course_id?: number;
}

interface CourseOption {
  id: number;
  title: string;
}

@Component({
  selector: 'app-ratings-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, TableModule, ButtonModule, DropdownModule, SkeletonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ratings-list.component.html',
})
export class RatingsListComponent implements OnInit {
  private api = inject(ApiService);

  items         = signal<Rating[]>([]);
  total         = signal(0);
  loading       = signal(true);
  courseOptions = signal<CourseOption[]>([]);

  perPage          = 20;
  page             = 1;
  search           = '';
  selectedCourseId: number | null = null;
  readonly starsArray = [0, 1, 2, 3, 4];

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
    this.loadCourseOptions();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<RatingRaw>(API.RATINGS, {
      page: this.page,
      per_page: this.perPage,
      search: this.search || undefined,
      course_id: this.selectedCourseId ?? undefined,
    }).subscribe({
      next:  res => {
        this.items.set(res.result.data.map(r => this.mapRating(r)));
        this.total.set(res.result.total);
        this.loading.set(false);
      },
      error: ()  => this.loading.set(false),
    });
  }

  private mapRating(r: RatingRaw): Rating {
    return {
      id:           r.id,
      user_name:    r.user?.name ?? '—',
      course_title: r.course?.title ?? '—',
      rating:       r.rating,
      comment:      r.review,
      created_at:   r.created_at,
      course_id:    r.course_id,
    };
  }

  loadCourseOptions(): void {
    this.api.getPaginated<CourseOption>(API.COURSES, { per_page: 200 })
      .subscribe({ next: res => this.courseOptions.set(res.result.data) });
  }

  onPage(event: TableLazyLoadEvent): void {
    this.page = Math.floor((event.first ?? 0) / (event.rows ?? this.perPage)) + 1;
    this.load();
  }

  onSearch(e: Event): void {
    this.search$.next((e.target as HTMLInputElement).value);
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }
}
