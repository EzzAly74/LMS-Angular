import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

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
  imports: [CommonModule, SkeletonModule, ConfirmDialogModule, NasPageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instructor-list.component.html',
  styleUrl: './instructor-list.component.scss',
})
export class InstructorListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

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
    this.confirmService.confirm({
      message: `Delete "${item.name}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.delete(`${API.INSTRUCTORS}/${item.id}`).subscribe({
          next: () => { this.messageService.add({ severity: 'success', detail: 'Instructor deleted.' }); this.load(); },
        });
      },
    });
  }
}
