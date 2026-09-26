import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { LocaleService } from '../../../../core/services/locale.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { ExternalTrainingRequest, REQUEST_STATUSES, RequestStats, RequestStatus } from '../../models/external-training.model';
import { ExternalTrainingApiService } from '../../services/external-training-api.service';
import { EtStatsComponent } from '../../components/et-stats/et-stats.component';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * External Training Requests - Figma 2181:116177 (D8).
 *
 * GET admin/external-training: the three tiles (pending, requests this year,
 * rejected this year) and the requests, pending first. The Course column is
 * the internal course an admin linked on approval, else the learner's own
 * title (Q-042). Search and the status chips are additions - Figma draws no
 * way to find one request among many (FG-34).
 */
@Component({
  selector: 'app-external-training-list',
  standalone: true,
  imports: [RouterLink, TranslateModule, SkeletonModule, NasIconComponent, NasPagerComponent, NasDatePipe, EtStatsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-list.component.html',
  styleUrl: './request-list.component.scss',
})
export class ExternalTrainingListComponent implements OnInit {
  private readonly api        = inject(ExternalTrainingApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale   = inject(LocaleService);

  readonly perPage   = 15;
  readonly skeletons = [1, 2, 3, 4, 5];
  readonly statuses  = REQUEST_STATUSES;

  readonly rows     = signal<ExternalTrainingRequest[]>([]);
  readonly total    = signal(0);
  readonly stats    = signal<RequestStats | null>(null);
  readonly page     = signal(1);
  readonly search   = signal('');
  readonly status   = signal<RequestStatus | null>(null);
  readonly state    = signal<LoadState>('loading');

  private readonly search$ = new Subject<string>();

  constructor() {
    withLocaleReload(() => this.load());
  }

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.search.set(term);
        this.page.set(1);
        this.load();
      });
    this.load();
  }

  load(): void {
    this.state.set('loading');
    const status = this.status();
    this.api.list(this.page(), this.perPage, this.search(), status ? [status] : [])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: p => {
          this.rows.set(p.rows);
          this.total.set(p.total);
          this.stats.set(p.stats);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }

  onSearch(term: string): void {
    this.search$.next(term.trim());
  }

  setStatus(status: RequestStatus | null): void {
    this.status.set(status);
    this.page.set(1);
    this.load();
  }

  onPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  courseOf(r: ExternalTrainingRequest): string {
    return r.course?.title ?? r.title;
  }
}
