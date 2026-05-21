import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface Role {
  id: number;
  name: string;
  /** Auth guard the role belongs to (`admin`, `web`, …). */
  guard_name?: string;
  /** Only present when permissions relation is eager-loaded. */
  permissions?: string[];
  created_at?: string;
}

interface PermissionGroup {
  table:       string;
  permissions: string[];
}

interface RoleFormState {
  name:     string;
  /** Set of selected permission names for fast lookup. */
  selected: Set<string>;
}

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    SkeletonModule, ConfirmDialogModule, DialogModule, CheckboxModule,
    NasPageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
})
export class RoleListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  constructor() { withLocaleReload(() => this.load()); }

  items   = signal<Role[]>([]);
  total   = signal(0);
  loading = signal(true);
  saving  = signal(false);

  /** Permissions grouped by table, refreshed per-guard when the dialog opens. */
  permissionGroups = signal<PermissionGroup[]>([]);
  /** Tracks which guards' permission lists we've already fetched + cached. */
  private permissionsCache = new Map<string, PermissionGroup[]>();
  /** Guard the *currently open* dialog targets. */
  private activeGuard: string = 'admin';

  /* Create / edit dialog */
  dialogVisible = false;
  dialogMode: 'create' | 'edit' = 'create';
  editingId: number | null = null;
  /** Guard of the role being edited — null for create (defaults to admin). */
  editingGuard: string | null = null;
  form: RoleFormState = this.emptyForm();
  permissionFilter = '';

  readonly perPage   = 20;
  page               = 1;
  search             = '';
  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min       = Math.min;

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
  }

  /* ── Data ─────────────────────────────────────────────────────────── */
  load(): void {
    this.loading.set(true);
    this.api.getPaginated<Role>(API.ROLES, {
      page: this.page, per_page: this.perPage, search: this.search || undefined,
    }).subscribe({
      next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  /**
   * Fetch permissions for the role's guard. Spatie won't allow assigning a
   * permission to a role unless they share a guard, so we filter the list
   * up-front to prevent the user from selecting incompatible permissions.
   * Results are cached per guard to avoid refetching on every open.
   */
  private ensurePermissionsLoaded(guard: string): void {
    this.activeGuard = guard;
    const cached = this.permissionsCache.get(guard);
    if (cached) {
      this.permissionGroups.set(cached);
      return;
    }

    this.permissionGroups.set([]); // show loader while fetching
    this.api.get<PermissionGroup[]>(API.PERMISSIONS, { guard }).subscribe({
      next: r => {
        const groups = Array.isArray(r.result) ? r.result : [];
        this.permissionsCache.set(guard, groups);
        // Only apply if the dialog is still on the same guard the user opened.
        if (this.activeGuard === guard) this.permissionGroups.set(groups);
      },
    });
  }

  /* ── Search / paging ──────────────────────────────────────────────── */
  onPage(p: number): void { this.page = p; this.load(); }
  onSearch(term: string): void { this.search$.next(term); }

  /* ── Create / edit ────────────────────────────────────────────────── */
  openCreate(): void {
    this.dialogMode    = 'create';
    this.editingId     = null;
    this.editingGuard  = null;
    this.form          = this.emptyForm();
    this.permissionFilter = '';
    // New roles default to the admin guard (the only one our permissions
    // currently live under, and the only one editable through this UI).
    this.ensurePermissionsLoaded('admin');
    this.dialogVisible = true;
  }

  openEdit(item: Role): void {
    // Re-fetch detail to ensure we have the latest permissions selection,
    // since the list response might be cached client-side.
    this.api.get<Role>(`${API.ROLES}/${item.id}`).subscribe({
      next: res => {
        const full = res.result;
        this.dialogMode    = 'edit';
        this.editingId     = full.id;
        this.editingGuard  = full.guard_name ?? 'admin';
        this.form = {
          name:     full.name ?? '',
          selected: new Set(full.permissions ?? []),
        };
        this.permissionFilter = '';
        this.ensurePermissionsLoaded(full.guard_name ?? 'admin');
        this.dialogVisible = true;
      },
    });
  }

  /** Active guard label shown in the dialog header — handy when editing a
   *  non-admin-guard role. Returns null for create flow. */
  guardLabel(): string | null {
    return this.dialogMode === 'edit' ? this.editingGuard ?? null : null;
  }

  togglePermission(name: string, checked: boolean): void {
    const next = new Set(this.form.selected);
    checked ? next.add(name) : next.delete(name);
    this.form = { ...this.form, selected: next };
  }

  toggleGroup(group: PermissionGroup, allSelected: boolean): void {
    const next = new Set(this.form.selected);
    if (allSelected) {
      group.permissions.forEach(p => next.delete(p));
    } else {
      group.permissions.forEach(p => next.add(p));
    }
    this.form = { ...this.form, selected: next };
  }

  isGroupAllSelected(group: PermissionGroup): boolean {
    return group.permissions.length > 0 && group.permissions.every(p => this.form.selected.has(p));
  }

  isGroupIndeterminate(group: PermissionGroup): boolean {
    const some = group.permissions.some(p => this.form.selected.has(p));
    return some && !this.isGroupAllSelected(group);
  }

  /** Permission groups filtered by the in-dialog search box. */
  visibleGroups(): PermissionGroup[] {
    const term = this.permissionFilter.trim().toLowerCase();
    if (!term) return this.permissionGroups();
    return this.permissionGroups()
      .map(g => ({
        table: g.table,
        permissions: g.permissions.filter(p =>
          p.toLowerCase().includes(term) || g.table.toLowerCase().includes(term),
        ),
      }))
      .filter(g => g.permissions.length > 0);
  }

  save(): void {
    // Guard against double-submit (e.g. Enter + click) — otherwise two
    // identical requests fire and the user sees the server's error toast twice.
    if (this.saving()) return;

    if (!this.form.name.trim()) {
      this.messageService.add({ severity: 'warn', detail: 'Role name is required.' });
      return;
    }
    this.saving.set(true);
    const payload: Record<string, unknown> = {
      name:        this.form.name.trim(),
      permissions: Array.from(this.form.selected),
    };
    // On create, anchor the role to the admin guard — the only guard our
    // permissions live under. On edit, the role's guard is fixed server-side.
    if (this.dialogMode === 'create') {
      payload['guard_name'] = 'admin';
    }

    const request$ = this.dialogMode === 'create'
      ? this.api.post(API.ROLES, payload)
      : this.api.put(`${API.ROLES}/${this.editingId}`, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible = false;
        this.messageService.add({
          severity: 'success',
          detail: this.dialogMode === 'create' ? 'Role created.' : 'Role updated.',
        });
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  confirmDelete(item: Role): void {
    this.confirmService.confirm({
      message: `Delete "${item.name}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.delete(`${API.ROLES}/${item.id}`).subscribe({
          next: () => { this.messageService.add({ severity: 'success', detail: 'Role deleted.' }); this.load(); },
        });
      },
    });
  }

  /* ── Helpers ──────────────────────────────────────────────────────── */
  selectedCount(): number { return this.form.selected.size; }

  private emptyForm(): RoleFormState {
    return { name: '', selected: new Set<string>() };
  }
}
