import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { DropdownModule } from 'primeng/dropdown';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { computed } from '@angular/core';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header/nas-page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface LmsResource {
  id: number;
  title: string;
  type: 'article' | 'link' | 'file';
  content?: string | null;
  url?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  qualification?: { id: number; name: string } | null;
  created_by_name?: string | null;
  created_at: string;
}

@Component({
  selector: 'app-resource-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    SkeletonModule,
    DropdownModule,
    ConfirmDialogModule,
    TranslateModule,
    NasPageHeaderComponent,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-list.component.html',
  styleUrl: './resource-list.component.scss',
})
export class ResourceListComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private enums = inject(EnumsService);
  private router = inject(Router);
  private confirm = inject(ConfirmationService);
  private t = inject(TranslateService);
  private destroy$ = new Subject<void>();
  private search$ = new Subject<string>();

  constructor() {
    withLocaleReload(() => this.load());
  }

  items = signal<LmsResource[]>([]);
  total = signal(0);
  loading = signal(true);
  deleting = signal<number | null>(null);
  openMenuId = signal<number | null>(null);

  search = '';
  selectedType = '';

  readonly perPage = 20;
  page = 1;
  readonly skeletons = [1, 2, 3, 4, 5, 6, 7];
  readonly min = Math.min;

  /**
   * Resource-type filter — driven by the backend `resource_type` enum so
   * the option list stays in sync with what the storage layer accepts.
   * We bind to the string `code` (not the numeric id) because this
   * dropdown drives a `?type=…` query-string filter and the backend's
   * filter clause matches string codes directly.
   *
   * "All Types" is a UI-only sentinel (empty string) prepended in front.
   */
  typeFilterOptions = computed(() => [
    { label: this.t.instant('common.all') + ' ' + this.t.instant('common.type') + 's', value: '' },
    ...this.enums.options('resource_type')().map(o => ({ label: o.value, value: o.code })),
  ]);

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 1;
        this.load();
      });
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = {
      page: this.page,
      per_page: this.perPage,
    };
    if (this.search.trim()) params['search'] = this.search.trim();
    if (this.selectedType) params['type'] = this.selectedType;

    this.api.getPaginated<LmsResource>(API.LMS_RESOURCES, params).subscribe({
      next: (res) => {
        this.items.set(res.result.data);
        this.total.set(res.result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearchInput(): void {
    this.search$.next(this.search);
  }

  onTypeChange(): void {
    this.page = 1;
    this.load();
  }

  onPage(p: number): void {
    this.page = p;
    this.load();
  }

  toggleMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  editResource(id: number): void {
    this.closeMenu();
    this.router.navigate(['/admin/resources', id, 'edit']);
  }

  confirmDelete(item: LmsResource, event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenu();
    this.confirm.confirm({
      message: this.t.instant('confirm.delete_message_title', { title: item.title }),
      header: this.t.instant('resources_list_toasts.delete_title'),
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-secondary p-button-sm',
      accept: () => this.deleteResource(item.id),
    });
  }

  private deleteResource(id: number): void {
    this.deleting.set(id);
    this.api.delete(`${API.LMS_RESOURCES}/${id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.load();
      },
      error: () => this.deleting.set(null),
    });
  }

  typeIcon(type: string): string {
    return type === 'link'
      ? 'pi pi-link'
      : type === 'file'
        ? 'pi pi-file'
        : 'pi pi-book';
  }

  /** Localized label for the type badge — sourced from the enum cache. */
  typeLabel(code: string): string {
    return this.enums.options('resource_type')().find(o => o.code === code)?.value ?? code;
  }
}
