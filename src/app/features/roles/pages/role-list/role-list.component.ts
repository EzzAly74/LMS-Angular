import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ChipModule } from 'primeng/chip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

interface Role {
  id: number;
  name: string;
  permissions: string[];
  created_at: string;
}

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, TableModule, ButtonModule, InputTextModule, ChipModule, ConfirmDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-list.component.html',
})
export class RoleListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  items   = signal<Role[]>([]);
  total   = signal(0);
  loading = signal(true);
  perPage = 20;
  page    = 1;
  search  = '';

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<Role>(API.ROLES, { page: this.page, per_page: this.perPage, search: this.search || undefined })
      .subscribe({
        next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  onPage(event: TableLazyLoadEvent): void {
    this.page = Math.floor((event.first ?? 0) / (event.rows ?? this.perPage)) + 1;
    this.load();
  }

  onSearch(e: Event): void {
    this.search$.next((e.target as HTMLInputElement).value);
  }

  confirmDelete(item: Role): void {
    this.confirmService.confirm({
      message: `Delete "${item.name}"?`,
      accept: () => {
        this.api.delete(`${API.ROLES}/${item.id}`).subscribe({
          next: () => { this.messageService.add({ severity: 'success', detail: 'Deleted.' }); this.load(); },
        });
      },
    });
  }
}
