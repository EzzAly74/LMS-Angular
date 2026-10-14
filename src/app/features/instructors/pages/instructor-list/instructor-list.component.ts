import { NasConfirmService } from '../../../../shared/nas/nas-confirm-modal/nas-confirm.service';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header/nas-page-header.component';
import { NasAvatarComponent } from '../../../../shared/nas/nas-avatar/nas-avatar.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { ToastService } from '../../../../core/services/toast.service';

interface Instructor {
  id: number;
  name: string;
  job_title?: string | null;
  bio?: string | null;
  image?: string | null;
  /** Only populated when the relation is eager-loaded with count. */
  courses_count?: number;
  created_at?: string;
}

@Component({
  selector: 'app-instructor-list',
  standalone: true,
  imports: [CommonModule, SkeletonModule, TranslateModule, NasPageHeaderComponent, NasAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instructor-list.component.html',
  styleUrl: './instructor-list.component.scss',
})
export class InstructorListComponent implements OnInit {
  private api            = inject(ApiService);
  private readonly confirmDialog = inject(NasConfirmService);
  private messageService = inject(ToastService);
  private t              = inject(TranslateService);

  constructor() { withLocaleReload(() => this.load()); }

  items   = signal<Instructor[]>([]);
  total   = signal(0);
  loading = signal(true);

  readonly perPage  = 20;
  page              = 1;
  search            = '';
  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min       = Math.min;

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<Instructor>(API.INSTRUCTORS, {
      page: this.page, per_page: this.perPage, search: this.search || undefined,
    }).subscribe({
      next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  onPage(p: number): void { this.page = p; this.load(); }

  onSearch(term: string): void { this.search$.next(term); }

  confirmDelete(item: Instructor): void {
    void this.confirmDialog.ask({
      title: this.t.instant('instructors.confirm_delete'),
      message: this.t.instant('confirm.delete_message_title', { title: item.name }),
    }).then(confirmed => {
      if (!confirmed) return;
      this.api.delete(`${API.INSTRUCTORS}/${item.id}`).subscribe({
        next: () => {
          this.messageService.success('instructors.deleted');
          this.load();
        },
      });
    });
  }
}
