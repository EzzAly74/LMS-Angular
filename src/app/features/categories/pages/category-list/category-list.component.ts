import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasConfirmModalComponent } from '../../../../shared/nas/nas-confirm-modal/nas-confirm-modal.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface Category {
  id: number;
  name: string;
  logo?: string | null;
  active?: boolean;
  courses_count?: number;
  created_at?: string;
}

interface CategoryFormState {
  id?: number;
  name_en: string;
  name_ar: string;
  active: boolean;
}

/**
 * Categories admin screen — Figma node 379:10759.
 *
 * Renders a clean two-column table (Category name, Linked Courses pill)
 * with a row-level "..." actions menu (edit / delete) and a Figma-aligned
 * "+ New Category" button that opens a single create/edit dialog. All
 * data — including the per-row course count — comes from `/api/v1/categories`
 * (the existing additive endpoint already returns `courses_count`).
 */
@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    SkeletonModule,
    OverlayPanelModule,
    TranslateModule,
    NasIconComponent,
    NasConfirmModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss',
})
export class CategoryListComponent implements OnInit, OnDestroy {
  private readonly api      = inject(ApiService);
  private readonly messages = inject(MessageService);
  private readonly t        = inject(TranslateService);

  @ViewChild('rowMenu') rowMenu?: OverlayPanel;

  /* ── List state ───────────────────────────────────────────────────── */
  items   = signal<Category[]>([]);
  total   = signal(0);
  loading = signal(true);

  readonly perPage   = 20;
  page               = signal(1);
  search             = signal('');
  readonly skeletons = [1, 2, 3, 4, 5];

  /* ── Dialog state ─────────────────────────────────────────────────── */
  dialogVisible = signal(false);
  dialogMode    = signal<'create' | 'edit'>('create');
  saving        = signal(false);

  form: CategoryFormState = {
    name_en:      '',
    name_ar:      '',
    active:       true,
  };

  /** Snapshot of the form at dialog-open, used to disable Save until something changes. */
  private formSnapshot = '';

  /* ── Confirm-delete state ─────────────────────────────────────────── */
  confirmDeleteOpen = signal(false);
  deleteTarget      = signal<Category | null>(null);
  deleteBusy        = signal(false);

  /* ── Row action menu state ────────────────────────────────────────── */
  menuTarget = signal<Category | null>(null);

  /* ── Derived ──────────────────────────────────────────────────────── */
  rangeStart = computed(() => (this.page() - 1) * this.perPage + 1);
  rangeEnd   = computed(() => Math.min(this.page() * this.perPage, this.total()));

  private readonly search$  = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor() {
    withLocaleReload(() => this.load());
  }

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => {
        this.search.set(q);
        this.page.set(1);
        this.load();
      });
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Data ─────────────────────────────────────────────────────────── */
  load(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = {
      page: this.page(),
      per_page: this.perPage,
    };
    if (this.search()) params['search'] = this.search();

    this.api.getPaginated<Category>(API.CATEGORIES, params).subscribe({
      next: res => {
        this.items.set(res.result.data);
        this.total.set(res.result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(term: string): void {
    this.search$.next(term);
  }

  onPage(p: number): void {
    if (p < 1) return;
    if ((p - 1) * this.perPage >= this.total()) return;
    this.page.set(p);
    this.load();
  }

  /* ── Row menu ─────────────────────────────────────────────────────── */
  openRowMenu(event: Event, item: Category): void {
    this.menuTarget.set(item);
    this.rowMenu?.toggle(event);
  }

  /* ── Dialog ───────────────────────────────────────────────────────── */
  openCreate(): void {
    this.resetForm();
    this.dialogMode.set('create');
    this.dialogVisible.set(true);
  }

  openEdit(item: Category): void {
    this.resetForm();
    this.form.id      = item.id;
    this.form.name_en = item.name ?? '';
    this.form.name_ar = item.name ?? '';
    this.form.active  = item.active ?? true;
    this.formSnapshot = this.snapshot();
    this.dialogMode.set('edit');
    this.dialogVisible.set(true);
    this.rowMenu?.hide();
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogVisible.set(false);
    this.resetForm();
  }

  private resetForm(): void {
    this.form = {
      name_en: '',
      name_ar: '',
      active:  true,
    };
    this.formSnapshot = this.snapshot();
  }

  /** Serialised form state — used to detect whether the user changed anything. */
  private snapshot(): string {
    return JSON.stringify({
      name_en: this.form.name_en.trim(),
      name_ar: this.form.name_ar.trim(),
      active:  this.form.active,
    });
  }

  /** Save is enabled only when the form is valid AND (on edit) something changed. */
  get isFormValid(): boolean {
    const en = this.form.name_en.trim();
    const ar = this.form.name_ar.trim();
    if (!en && !ar) return false;
    if (this.dialogMode() === 'edit' && this.snapshot() === this.formSnapshot) return false;
    return true;
  }

  save(): void {
    if (!this.isFormValid || this.saving()) return;
    const fd = new FormData();
    fd.append('name[en]', this.form.name_en.trim() || this.form.name_ar.trim());
    fd.append('name[ar]', this.form.name_ar.trim() || this.form.name_en.trim());
    fd.append('active', this.form.active ? '1' : '0');

    this.saving.set(true);
    if (this.dialogMode() === 'create') {
      this.api.post<Category>(API.CATEGORIES, fd).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible.set(false);
          this.resetForm();
          this.messages.add({
            severity: 'success',
            summary: this.t.instant('common.created'),
            detail:  this.t.instant('categories_toasts.created'),
          });
          this.load();
        },
        error: () => this.saving.set(false),
      });
    } else if (this.form.id) {
      /**
       * Laravel maps PUT with FormData inconsistently across HTTP clients.
       * Sending `_method=PUT` via POST is the canonical multipart-update
       * pattern that the existing backend already honours.
       */
      fd.append('_method', 'PUT');
      this.api.post<Category>(`${API.CATEGORIES}/${this.form.id}`, fd).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible.set(false);
          this.resetForm();
          this.messages.add({
            severity: 'success',
            summary: this.t.instant('common.updated'),
            detail:  this.t.instant('categories_toasts.updated'),
          });
          this.load();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  /* ── Delete confirm flow ─────────────────────────────────────────── */
  requestDelete(item: Category): void {
    this.deleteTarget.set(item);
    this.confirmDeleteOpen.set(true);
    this.rowMenu?.hide();
  }

  confirmDelete(): void {
    const t = this.deleteTarget();
    if (!t) return;
    this.deleteBusy.set(true);
    this.api.delete(`${API.CATEGORIES}/${t.id}`).subscribe({
      next: () => {
        this.deleteBusy.set(false);
        this.confirmDeleteOpen.set(false);
        this.deleteTarget.set(null);
        this.messages.add({
          severity: 'success',
          summary: this.t.instant('common.deleted'),
          detail:  this.t.instant('categories_toasts.deleted'),
        });
        this.load();
      },
      error: () => this.deleteBusy.set(false),
    });
  }

  cancelDelete(): void {
    if (this.deleteBusy()) return;
    this.confirmDeleteOpen.set(false);
    this.deleteTarget.set(null);
  }

  deleteMessage = computed(() => {
    const item = this.deleteTarget();
    return item ? this.t.instant('confirm.delete_message_title', { title: item.name }) : '';
  });
}
