import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslateModule } from '@ngx-translate/core';

import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { AdminRolesApiService } from '../../services/admin-roles-api.service';
import type {
  AdminRoleColor,
  AdminRoleDetail,
  AdminRoleSectionCatalog,
  AdminRoleStorePayload,
} from '../../models/role.types';

interface RoleFormState {
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  color: AdminRoleColor;
  selected: Set<string>;
}

@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SkeletonModule,
    ToastModule,
    TranslateModule,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class RoleFormComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminRolesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  private readonly destroy$ = new Subject<void>();

  readonly colors: AdminRoleColor[] = [
    'teal',
    'green',
    'orange',
    'red',
    'blue',
  ];

  /* ── Mode + identity ─────────────────────────────────────────── */
  readonly editingId = signal<number | null>(null);
  readonly mode = computed<'create' | 'edit'>(() =>
    this.editingId() === null ? 'create' : 'edit',
  );
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly isSystem = signal(false);

  /* ── Catalog ─────────────────────────────────────────────────── */
  readonly catalog = signal<AdminRoleSectionCatalog | null>(null);
  readonly catalogLoading = signal(true);

  /* ── Form state ──────────────────────────────────────────────── */
  readonly form = signal<RoleFormState>(this.emptyForm());

  /* ── Derived ─────────────────────────────────────────────────── */
  readonly totalViews = computed(() => this.catalog()?.total ?? 0);
  readonly selectedCount = computed(() => this.form().selected.size);
  readonly noneSelected = computed(() => this.selectedCount() === 0);

  /** Per-group `selected / total`. */
  readonly groupCounts = computed(() => {
    const groups = this.catalog()?.groups ?? [];
    const sel = this.form().selected;
    return groups.map((g) => ({
      group: g,
      selected: g.items.filter((i) => sel.has(i.key)).length,
      total: g.items.length,
    }));
  });

  readonly canSubmit = computed(() => {
    const f = this.form();
    return (
      f.name_en.trim().length > 0 &&
      f.name_ar.trim().length > 0 &&
      !this.saving()
    );
  });

  constructor() {
    withLocaleReload(() => this.loadCatalog());
  }

  /* ── Lifecycle ───────────────────────────────────────────────── */
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editingId.set(+id);
      this.loadRole(+id);
    }
    this.loadCatalog();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Loaders ─────────────────────────────────────────────────── */
  private loadCatalog(): void {
    this.catalogLoading.set(true);
    this.api
      .sections()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.catalog.set(res.result);
          this.catalogLoading.set(false);
        },
        error: () => this.catalogLoading.set(false),
      });
  }

  private loadRole(id: number): void {
    this.loading.set(true);
    this.api
      .show(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const r = res.result;
          this.isSystem.set(r.is_system);
          this.form.set({
            name_en: r.name_en ?? r.name ?? '',
            name_ar: r.name_ar ?? '',
            description_en: r.description_en ?? '',
            description_ar: r.description_ar ?? '',
            color: r.color,
            selected: new Set(r.view_keys),
          });
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Could not load this role. Please retry.',
          });
        },
      });
  }

  /* ── Field updates ───────────────────────────────────────────── */
  updateField<K extends keyof RoleFormState>(
    field: K,
    value: RoleFormState[K],
  ): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  pickColor(color: AdminRoleColor): void {
    this.form.update((f) => ({ ...f, color }));
  }

  /* ── Selection helpers ───────────────────────────────────────── */
  isSelected(key: string): boolean {
    return this.form().selected.has(key);
  }

  toggle(key: string): void {
    this.form.update((f) => {
      const next = new Set(f.selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...f, selected: next };
    });
  }

  isGroupAllSelected(items: { key: string }[]): boolean {
    if (!items.length) return false;
    const sel = this.form().selected;
    return items.every((i) => sel.has(i.key));
  }

  selectGroup(items: { key: string }[]): void {
    this.form.update((f) => {
      const next = new Set(f.selected);
      items.forEach((i) => next.add(i.key));
      return { ...f, selected: next };
    });
  }

  clearGroup(items: { key: string }[]): void {
    this.form.update((f) => {
      const next = new Set(f.selected);
      items.forEach((i) => next.delete(i.key));
      return { ...f, selected: next };
    });
  }

  selectAll(): void {
    const all = (this.catalog()?.groups ?? [])
      .flatMap((g) => g.items)
      .map((i) => i.key);
    this.form.update((f) => ({ ...f, selected: new Set(all) }));
  }

  clearAll(): void {
    this.form.update((f) => ({ ...f, selected: new Set() }));
  }

  /* ── Save / cancel ───────────────────────────────────────────── */
  cancel(): void {
    this.router.navigate(['/admin/roles']);
  }

  submit(): void {
    if (!this.canSubmit()) return;

    this.saving.set(true);
    const f = this.form();
    const payload: AdminRoleStorePayload = {
      name_en: f.name_en.trim(),
      name_ar: f.name_ar.trim(),
      description_en: f.description_en.trim() || null,
      description_ar: f.description_ar.trim() || null,
      color: f.color,
      view_keys: Array.from(f.selected),
    };

    const request$ =
      this.mode() === 'create'
        ? this.api.create(payload)
        : this.api.update(this.editingId()!, payload);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Saved',
          detail: this.mode() === 'create' ? 'Role created.' : 'Role updated.',
        });
        this.router.navigate(['/admin/roles']);
      },
      error: (err) => {
        this.saving.set(false);
        const detail =
          err?.error?.message ??
          err?.error?.errors ??
          'Could not save the role. Please retry.';
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
        });
      },
    });
  }

  /* ── Visuals ────────────────────────────────────────────────── */
  badgePreviewClass(): string {
    switch (this.form().color) {
      case 'green':
        return 'rf-badge--green';
      case 'orange':
        return 'rf-badge--orange';
      case 'red':
        return 'rf-badge--red';
      case 'blue':
        return 'rf-badge--blue';
      default:
        return 'rf-badge--teal';
    }
  }

  swatchClass(color: AdminRoleColor): string {
    return `rf-swatch--${color}`;
  }

  /* ── Internals ──────────────────────────────────────────────── */
  private emptyForm(): RoleFormState {
    return {
      name_en: '',
      name_ar: '',
      description_en: '',
      description_ar: '',
      color: 'teal',
      selected: new Set<string>(),
    };
  }
}
