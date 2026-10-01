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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { AdminRolesApiService } from '../../services/admin-roles-api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { AuthService } from '../../../../core/services/auth.service';
import type { CourseScope, PermissionAction } from '../../../../core/models/auth.types';
import type {
  AdminRoleColor,
  AdminRoleSectionCatalog,
  AdminRoleSectionItem,
  AdminRoleStorePayload,
} from '../../models/role.types';
import { ToastService } from '../../../../core/services/toast.service';

interface RoleFormState {
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  color: AdminRoleColor;
  courseScope: CourseScope;
  /** Matrix permissions, `{action}-{section}`. */
  selected: Set<string>;
}

/** One cell of the matrix as the template draws it. */
interface MatrixCell {
  action: PermissionAction;
  permission: string;
  /** The section has this action. */
  supported: boolean;
  checked: boolean;
  /** The signed-in admin may not grant it, or the course scope rules it out. */
  disabled: boolean;
}

interface MatrixRow {
  item: AdminRoleSectionItem;
  cells: MatrixCell[];
  /** Every supported action is on / some are. */
  all: boolean;
  some: boolean;
  /** Org-wide section under an "own courses" scope (D-074). */
  scopeBlocked: boolean;
  disabled: boolean;
}

const permissionOf = (action: PermissionAction, section: string): string => `${action}-${section}`;

/**
 * Create / edit a role (D-073): identity, badge colour, course access (D-074)
 * and the permission matrix - View / Create / Edit / Delete per Dashboard
 * section, grouped as in the sidebar.
 *
 * The matrix keeps itself consistent: any write action turns View on, and
 * turning View off clears the row. Permissions the signed-in admin does not
 * hold are shown but cannot be ticked (the server refuses them anyway), and a
 * role limited to its own courses cannot take organisation-wide sections.
 * A role the admin may not change (their own, or a super admin's) opens read
 * only.
 */
@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SkeletonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class RoleFormComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminRolesApiService);
  private readonly enums = inject(EnumsService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(ToastService);
  private readonly t = inject(TranslateService);

  private readonly destroy$ = new Subject<void>();

  readonly colorOptions = this.enums.options('role_color');
  readonly colors = computed<AdminRoleColor[]>(() => this.colorOptions().map(o => o.code as AdminRoleColor));

  /* ── Mode + identity ─────────────────────────────────────────── */
  readonly editingId = signal<number | null>(null);
  readonly mode = computed<'create' | 'edit'>(() => (this.editingId() === null ? 'create' : 'edit'));
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly isSystem = signal(false);
  readonly isSuperRole = signal(false);
  /** False for the admin's own role or a super-admin role: read only. */
  readonly canManage = signal(true);

  /** Course access choices (D-074). */
  readonly scopes: readonly CourseScope[] = ['all', 'assigned'];

  /* ── Catalog ─────────────────────────────────────────────────── */
  readonly catalog = signal<AdminRoleSectionCatalog | null>(null);
  readonly catalogLoading = signal(true);

  /* ── Form state ──────────────────────────────────────────────── */
  readonly form = signal<RoleFormState>(this.emptyForm());

  readonly readOnly = computed(() => !this.canManage() || this.isSuperRole());

  /** Column headers, in order. */
  readonly actions = computed(() => this.catalog()?.actions ?? []);

  /** The matrix, ready to draw. */
  readonly matrix = computed(() => {
    const f = this.form();
    const readOnly = this.readOnly();
    const actions = this.actions().map(a => a.key);

    return (this.catalog()?.groups ?? []).map(group => {
      const rows: MatrixRow[] = group.items.map(item => {
        const scopeBlocked = f.courseScope === 'assigned' && item.org_wide;
        const cells = actions.map<MatrixCell>(action => {
          const permission = permissionOf(action, item.key);
          const supported = item.actions.includes(action);
          return {
            action,
            permission,
            supported,
            checked: supported && f.selected.has(permission),
            disabled: !supported || readOnly || scopeBlocked || !this.grantable(permission),
          };
        });
        // View stays on while the role keeps a write the admin cannot remove.
        if (cells.some(c => c.supported && c.action !== 'view' && c.checked && c.disabled)) {
          cells.filter(c => c.action === 'view').forEach(c => (c.disabled = true));
        }
        const on = cells.filter(c => c.supported && c.checked).length;
        const supported = cells.filter(c => c.supported).length;
        return {
          item,
          cells,
          all: supported > 0 && on === supported,
          some: on > 0 && on < supported,
          scopeBlocked,
          disabled: readOnly || scopeBlocked || cells.every(c => !c.supported || c.disabled),
        };
      });
      const selected = rows.reduce((n, r) => n + r.cells.filter(c => c.checked).length, 0);
      const total = rows.reduce((n, r) => n + r.cells.filter(c => c.supported).length, 0);
      return { group, rows, selected, total };
    });
  });

  readonly totalPermissions = computed(() => this.catalog()?.total ?? 0);
  readonly selectedCount = computed(() => this.matrix().reduce((n, g) => n + g.selected, 0));
  readonly noneSelected = computed(() => this.selectedCount() === 0);
  /** Sections with View on. */
  readonly sectionsVisible = computed(
    () => this.matrix().reduce((n, g) => n + g.rows.filter(r => r.cells.some(c => c.action === 'view' && c.checked)).length, 0),
  );

  readonly canSubmit = computed(() => {
    const f = this.form();
    return !this.readOnly() && f.name_en.trim().length > 0 && f.name_ar.trim().length > 0 && !this.saving();
  });

  constructor() {
    withLocaleReload(() => {
      this.loadCatalog();
      const id = this.editingId();
      if (id !== null) this.loadRole(id);
    });
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
    this.api.sections().pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.catalog.set(res.result);
        this.catalogLoading.set(false);
      },
      error: () => this.catalogLoading.set(false),
    });
  }

  private loadRole(id: number): void {
    this.loading.set(true);
    this.api.show(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        const r = res.result;
        this.isSystem.set(r.is_system);
        this.isSuperRole.set(r.is_super_admin);
        this.canManage.set(r.can_manage);
        this.form.set({
          name_en: r.name_en ?? r.name ?? '',
          name_ar: r.name_ar ?? '',
          description_en: r.description_en ?? '',
          description_ar: r.description_ar ?? '',
          color: r.color,
          courseScope: r.course_scope ?? 'all',
          selected: new Set(r.permissions ?? r.view_keys),
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.error('roles_toasts.load_failed');
      },
    });
  }

  /* ── Field updates ───────────────────────────────────────────── */
  updateField<K extends keyof RoleFormState>(field: K, value: RoleFormState[K]): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  pickColor(color: AdminRoleColor): void {
    this.form.update(f => ({ ...f, color }));
  }

  /**
   * Course access. Limiting a role to its own courses clears the
   * organisation-wide sections, which such a role cannot use (D-074).
   */
  pickScope(scope: CourseScope): void {
    if (this.readOnly()) return;
    this.form.update(f => {
      const next = new Set(f.selected);
      if (scope === 'assigned') {
        for (const item of this.items()) {
          if (item.org_wide) item.actions.forEach(a => next.delete(permissionOf(a, item.key)));
        }
      }
      return { ...f, courseScope: scope, selected: next };
    });
  }

  /* ── Matrix ──────────────────────────────────────────────────── */
  toggle(cell: MatrixCell, row: MatrixRow): void {
    if (cell.disabled) return;
    this.form.update(f => {
      const next = new Set(f.selected);
      const view = permissionOf('view', row.item.key);
      if (next.has(cell.permission)) {
        next.delete(cell.permission);
        // No writes without View.
        if (cell.action === 'view') row.cells.filter(c => !c.disabled).forEach(c => next.delete(c.permission));
      } else {
        next.add(cell.permission);
        if (cell.action !== 'view' && row.item.actions.includes('view')) next.add(view);
      }
      return { ...f, selected: next };
    });
  }

  /** The row's own checkbox: every action the admin may grant, or none. */
  toggleRow(row: MatrixRow): void {
    if (row.disabled) return;
    const grantable = row.cells.filter(c => c.supported && !c.disabled);
    const turnOn = !row.all;
    this.form.update(f => {
      const next = new Set(f.selected);
      grantable.forEach(c => (turnOn ? next.add(c.permission) : next.delete(c.permission)));
      return { ...f, selected: next };
    });
  }

  selectGroup(rows: MatrixRow[]): void {
    this.setRows(rows, true);
  }

  clearGroup(rows: MatrixRow[]): void {
    this.setRows(rows, false);
  }

  selectAll(): void {
    this.setRows(this.matrix().flatMap(g => g.rows), true);
  }

  clearAll(): void {
    this.setRows(this.matrix().flatMap(g => g.rows), false);
  }

  /** Accessible name of a cell: "Create - Courses". */
  cellLabel(cell: MatrixCell, row: MatrixRow): string {
    const action = this.actions().find(a => a.key === cell.action)?.label ?? cell.action;
    return `${action} - ${row.item.label}`;
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
      course_scope: f.courseScope,
      permissions: Array.from(f.selected),
    };

    const request$ = this.mode() === 'create' ? this.api.create(payload) : this.api.update(this.editingId()!, payload);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.messages.success(this.t.instant(this.mode() === 'create' ? 'common.created' : 'common.updated'), { title: 'common.saved' });
        this.router.navigate(['/admin/roles']);
      },
      // The error interceptor shows the server's reason (422 / 403).
      error: () => this.saving.set(false),
    });
  }

  /* ── Visuals ────────────────────────────────────────────────── */
  badgePreviewClass(): string {
    const color = this.form().color;
    return color === 'teal' ? 'rf-badge--teal' : `rf-badge--${color}`;
  }

  swatchClass(color: AdminRoleColor): string {
    return `rf-swatch--${color}`;
  }

  /* ── Internals ──────────────────────────────────────────────── */
  private items(): AdminRoleSectionItem[] {
    return (this.catalog()?.groups ?? []).flatMap(g => g.items);
  }

  /**
   * The admin may tick or untick only a permission they hold themselves. One
   * they lack stays exactly as the role has it, as the server keeps it.
   */
  private grantable(permission: string): boolean {
    return this.auth.can(permission);
  }

  private setRows(rows: MatrixRow[], on: boolean): void {
    if (this.readOnly()) return;
    this.form.update(f => {
      const next = new Set(f.selected);
      rows.forEach(r => r.cells.filter(c => c.supported && !c.disabled).forEach(c => (on ? next.add(c.permission) : next.delete(c.permission))));
      return { ...f, selected: next };
    });
  }

  private emptyForm(): RoleFormState {
    return {
      name_en: '',
      name_ar: '',
      description_en: '',
      description_ar: '',
      color: 'teal',
      courseScope: 'all',
      selected: new Set<string>(),
    };
  }
}
