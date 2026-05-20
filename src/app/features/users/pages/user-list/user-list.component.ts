import {
  ChangeDetectionStrategy, Component, OnInit, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

type UserRole        = 'learner' | 'instructor';
type LearnerType     = 'online' | 'offline' | 'hybrid';
type ActiveTab       = 'all' | 'learner' | 'instructor';
type LearnerSubFilter = 'all' | 'online' | 'offline' | 'hybrid';

interface User {
  id: number;
  name: string;
  email: string;
  job_title?: string;
  department_name?: string;
  machine_code?: string;
  learner_type?: LearnerType;
  role?: UserRole;
  is_online?: boolean;
}

interface EditForm {
  name: string;
  email: string;
  job_title: string;
  department_name: string;
  learner_type: LearnerType | '';
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    TableModule, ButtonModule, InputTextModule, SkeletonModule,
    DialogModule, ConfirmDialogModule, DropdownModule, TagModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  items      = signal<User[]>([]);
  total      = signal(0);
  loading    = signal(true);
  saving     = signal(false);
  activeTab  = signal<ActiveTab>('all');
  learnerSubFilter = signal<LearnerSubFilter>('all');
  profileUser = signal<User | null>(null);

  editVisible = false;
  editUserId: number | null = null;
  editForm: EditForm = { name: '', email: '', job_title: '', department_name: '', learner_type: '' };

  perPage = 15;
  page    = 1;
  search  = '';

  private search$ = new Subject<string>();

  readonly tabs: { key: ActiveTab; label: string }[] = [
    { key: 'all',        label: 'All' },
    { key: 'learner',    label: 'Learners' },
    { key: 'instructor', label: 'Instructors' },
  ];

  readonly subFilters: { key: LearnerSubFilter; label: string }[] = [
    { key: 'all',     label: 'All' },
    { key: 'online',  label: 'Online' },
    { key: 'offline', label: 'Offline' },
    { key: 'hybrid',  label: 'Hybrid' },
  ];

  readonly learnerTypeOptions = [
    { label: 'Online',  value: 'online' },
    { label: 'Offline', value: 'offline' },
    { label: 'Hybrid',  value: 'hybrid' },
  ];

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const params: Record<string, string | number | boolean> = { page: this.page, per_page: this.perPage };
    if (this.search) params['search'] = this.search;
    if (this.activeTab() !== 'all') params['role'] = this.activeTab();
    if (this.activeTab() === 'learner' && this.learnerSubFilter() !== 'all') {
      params['learner_type'] = this.learnerSubFilter();
    }

    this.api.getPaginated<User>(API.USERS, params).subscribe({
      next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.learnerSubFilter.set('all');
    this.page = 1;
    this.load();
  }

  setSubFilter(sf: LearnerSubFilter): void {
    this.learnerSubFilter.set(sf);
    this.page = 1;
    this.load();
  }

  onPage(event: TableLazyLoadEvent): void {
    this.page = Math.floor((event.first ?? 0) / (event.rows ?? this.perPage)) + 1;
    this.load();
  }

  onSearch(e: Event): void {
    this.search$.next((e.target as HTMLInputElement).value);
  }

  openProfile(user: User): void {
    this.profileUser.set(user);
  }

  closeProfile(): void {
    this.profileUser.set(null);
  }

  openEdit(user: User): void {
    this.editUserId = user.id;
    this.editForm = {
      name:            user.name,
      email:           user.email,
      job_title:       user.job_title ?? '',
      department_name: user.department_name ?? '',
      learner_type:    user.learner_type ?? '',
    };
    this.editVisible = true;
  }

  saveEdit(): void {
    if (!this.editUserId) return;
    this.saving.set(true);
    this.api.put(`${API.USERS}/${this.editUserId}`, this.editForm).subscribe({
      next: () => {
        this.saving.set(false);
        this.editVisible = false;
        this.messageService.add({ severity: 'success', detail: 'User updated.' });
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  confirmDelete(user: User): void {
    this.confirmService.confirm({
      message: `Delete "${user.name}"?`,
      accept: () => {
        this.api.delete(`${API.USERS}/${user.id}`).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', detail: 'Deleted.' });
            this.load();
          },
        });
      },
    });
  }
}
