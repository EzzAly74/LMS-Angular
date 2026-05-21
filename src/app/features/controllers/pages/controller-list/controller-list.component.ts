import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateModule } from '@ngx-translate/core';

import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

interface Controller {
  id: number;
  name: string;
  email: string;
  /** Eager-loaded by /admins/{id} only — array of Spatie role names. */
  roles?: string[];
  created_at?: string;
}

interface RoleOption {
  id: number;
  name: string;
}

interface ControllerForm {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: string;
}

@Component({
  selector: 'app-controller-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    SkeletonModule, DialogModule, DropdownModule, ConfirmDialogModule,
    NasPageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './controller-list.component.html',
  styleUrl: './controller-list.component.scss',
})
export class ControllerListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  items   = signal<Controller[]>([]);
  total   = signal(0);
  loading = signal(true);
  saving  = signal(false);

  roleOptions = signal<RoleOption[]>([]);

  /* Create / edit dialog */
  dialogVisible = false;
  dialogMode: 'create' | 'edit' = 'create';
  editingId: number | null = null;
  form: ControllerForm = this.emptyForm();

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
    this.loadRoles();
  }

  /* ── Data ─────────────────────────────────────────────────────────── */
  load(): void {
    this.loading.set(true);
    this.api.getPaginated<Controller>(API.ADMINS, {
      page: this.page, per_page: this.perPage, search: this.search || undefined,
    }).subscribe({
      next:  res => {
        this.items.set(res.result.data);
        this.total.set(res.result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadRoles(): void {
    // The role dropdown needs every role name available to the admin guard —
    // a single small page is enough since roles are a small dataset.
    this.api.getPaginated<RoleOption>(API.ROLES, { per_page: 100 }).subscribe({
      next: res => this.roleOptions.set(res.result.data ?? []),
    });
  }

  /* ── Search / paging ──────────────────────────────────────────────── */
  onPage(p: number): void { this.page = p; this.load(); }
  onSearch(term: string): void { this.search$.next(term); }

  /* ── Create / edit ────────────────────────────────────────────────── */
  openCreate(): void {
    this.dialogMode = 'create';
    this.editingId  = null;
    this.form       = this.emptyForm();
    this.dialogVisible = true;
  }

  openEdit(item: Controller): void {
    // The list response doesn't carry `roles`, so re-fetch detail to populate
    // the form accurately for the current admin.
    this.api.get<Controller>(`${API.ADMINS}/${item.id}`).subscribe({
      next: res => {
        const full = res.result;
        this.dialogMode = 'edit';
        this.editingId  = full.id;
        this.form = {
          name:                  full.name ?? '',
          email:                 full.email ?? '',
          password:              '',
          password_confirmation: '',
          role:                  full.roles?.[0] ?? '',
        };
        this.dialogVisible = true;
      },
    });
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.email.trim() || !this.form.role) {
      this.messageService.add({ severity: 'warn', detail: 'Name, email and role are required.' });
      return;
    }
    if (this.dialogMode === 'create' && this.form.password.length < 8) {
      this.messageService.add({ severity: 'warn', detail: 'Password must be at least 8 characters.' });
      return;
    }
    if (this.form.password && this.form.password !== this.form.password_confirmation) {
      this.messageService.add({ severity: 'warn', detail: 'Passwords do not match.' });
      return;
    }

    this.saving.set(true);
    const payload: Record<string, string> = {
      name:  this.form.name.trim(),
      email: this.form.email.trim(),
      role:  this.form.role,
    };
    if (this.form.password) {
      payload['password']              = this.form.password;
      payload['password_confirmation'] = this.form.password_confirmation;
    }

    const request$ = this.dialogMode === 'create'
      ? this.api.post(API.ADMINS, payload)
      : this.api.put(`${API.ADMINS}/${this.editingId}`, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible = false;
        this.messageService.add({
          severity: 'success',
          detail: this.dialogMode === 'create' ? 'Controller created.' : 'Controller updated.',
        });
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  confirmDelete(item: Controller): void {
    this.confirmService.confirm({
      message: `Delete controller "${item.name}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.delete(`${API.ADMINS}/${item.id}`).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', detail: 'Controller deleted.' });
            this.load();
          },
        });
      },
    });
  }

  /* ── Helpers ──────────────────────────────────────────────────────── */
  initial(name: string | undefined | null): string {
    return (name ?? '').trim().charAt(0).toUpperCase() || '?';
  }

  private emptyForm(): ControllerForm {
    return { name: '', email: '', password: '', password_confirmation: '', role: '' };
  }
}
