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
import { RouterLink, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { NasPageHeaderComponent } from '../../../../shared/nas';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { AdminRolesApiService } from '../../services/admin-roles-api.service';
import type {
  AdminRoleListItem,
  AdminRoleSectionCatalog,
  AdminRoleSectionGroup,
} from '../../models/role.types';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SkeletonModule,
    DialogModule,
    ToastModule,
    TranslateModule,
    NasPageHeaderComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
})
export class RoleListComponent implements OnInit, OnDestroy {
  private readonly api      = inject(AdminRolesApiService);
  private readonly router   = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly t        = inject(TranslateService);

  private readonly destroy$ = new Subject<void>();
  private readonly search$  = new Subject<string>();

  readonly skeletonCards = [1, 2, 3, 4];

  constructor() {
    withLocaleReload(() => this.refresh());
  }

  /* ── Data ────────────────────────────────────────────────────── */
  readonly roles      = signal<AdminRoleListItem[]>([]);
  readonly totalViews = signal(0);
  readonly catalog    = signal<AdminRoleSectionCatalog | null>(null);
  readonly loading    = signal(true);

  /* ── List state ──────────────────────────────────────────────── */
  search = '';

  /* ── Per-card expand state (multi-open) ──────────────────────── */
  readonly expandedSet = signal<Set<number>>(new Set());

  /* ── Per-card kebab menu ─────────────────────────────────────── */
  readonly menuOpenId = signal<number | null>(null);

  /* ── Delete confirmation ─────────────────────────────────────── */
  readonly deleteTarget = signal<AdminRoleListItem | null>(null);
  readonly deleting     = signal(false);

  /* ── Computed ────────────────────────────────────────────────── */
  readonly visibleRoles = computed(() => {
    const term = this.search.trim().toLowerCase();
    const all  = this.roles();
    if (!term) return all;
    return all.filter(r =>
      (r.name             ?? '').toLowerCase().includes(term) ||
      (r.name_en          ?? '').toLowerCase().includes(term) ||
      (r.name_ar          ?? '').toLowerCase().includes(term) ||
      (r.description      ?? '').toLowerCase().includes(term) ||
      (r.machine_name     ?? '').toLowerCase().includes(term),
    );
  });

  /* ── Lifecycle ───────────────────────────────────────────────── */
  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => this.search = v);

    this.refresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Loaders ─────────────────────────────────────────────────── */
  refresh(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: res => {
        this.roles.set(res.result.roles ?? []);
        this.totalViews.set(res.result.total_views ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.api.sections().subscribe({
      next: res => this.catalog.set(res.result),
    });
  }

  /* ── Interactions ────────────────────────────────────────────── */
  onSearch(v: string): void { this.search$.next(v); }

  goToCreate(): void {
    this.router.navigate(['/admin/roles/new']);
  }

  goToEdit(role: AdminRoleListItem): void {
    this.closeMenu();
    this.router.navigate(['/admin/roles', role.id, 'edit']);
  }

  /* ── Card expand state ──────────────────────────────────────── */
  isExpanded(id: number): boolean {
    return this.expandedSet().has(id);
  }

  toggleExpand(id: number, ev?: MouseEvent): void {
    ev?.stopPropagation();
    this.expandedSet.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ── Card kebab menu ────────────────────────────────────────── */
  toggleMenu(id: number, ev: MouseEvent): void {
    ev.stopPropagation();
    this.menuOpenId.set(this.menuOpenId() === id ? null : id);
  }

  closeMenu(): void { this.menuOpenId.set(null); }

  /* ── Delete flow ────────────────────────────────────────────── */
  askDelete(role: AdminRoleListItem): void {
    this.closeMenu();
    this.deleteTarget.set(role);
  }

  cancelDelete(): void { this.deleteTarget.set(null); }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.deleting()) return;

    this.deleting.set(true);
    this.api.destroy(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.messages.add({
          severity: 'success',
          summary:  this.t.instant('common.deleted'),
          detail:   this.t.instant('roles.deleted'),
        });
        this.refresh();
      },
      error: (err) => {
        this.deleting.set(false);
        const msg = err?.error?.message
                 ?? err?.error?.errors?.role?.[0]
                 ?? this.t.instant('errors.unexpected');
        this.messages.add({ severity: 'error', summary: this.t.instant('errors.title'), detail: msg });
      },
    });
  }

  /* ── Helpers for the expanded section pills ─────────────────── */
  groupsForRole(role: AdminRoleListItem): Array<{
    group: AdminRoleSectionGroup;
    visible: { key: string; label: string }[];
    hidden: number;
  }> {
    const groups = this.catalog()?.groups ?? [];
    const selectedSet = new Set(role.view_keys);

    return groups.map(group => {
      const selected = group.items.filter(item => selectedSet.has(item.key));
      const VISIBLE_MAX = 6;
      return {
        group,
        visible: selected.slice(0, VISIBLE_MAX),
        hidden:  Math.max(0, selected.length - VISIBLE_MAX),
      };
    }).filter(g => g.visible.length > 0 || g.hidden > 0);
  }

  /* ── Visual helpers ─────────────────────────────────────────── */
  cardColorClass(color: string): string {
    switch (color) {
      case 'green':  return 'rl-card--green';
      case 'orange': return 'rl-card--orange';
      case 'red':    return 'rl-card--red';
      case 'blue':   return 'rl-card--blue';
      default:       return 'rl-card--teal';
    }
  }

  badgeColorClass(color: string): string {
    switch (color) {
      case 'green':  return 'rl-badge--green';
      case 'orange': return 'rl-badge--orange';
      case 'red':    return 'rl-badge--red';
      case 'blue':   return 'rl-badge--blue';
      default:       return 'rl-badge--teal';
    }
  }
}
