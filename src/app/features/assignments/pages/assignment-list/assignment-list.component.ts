import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { API, courseUrl } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface CourseOption { id: number; title: string; }
interface Assignment {
  id: number;
  title: string;
  file_url: string | null;
  created_at: string;
}

@Component({
  selector: 'app-assignment-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DropdownModule, ConfirmDialogModule, SkeletonModule, NasPageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assignment-list.component.html',
  styleUrl: './assignment-list.component.scss',
})
export class AssignmentListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  constructor() {
    withLocaleReload(() => {
      if (this.selectedCourseId) this.load();
    });
  }

  courses        = signal<CourseOption[]>([]);
  coursesLoading = signal(true);
  items          = signal<Assignment[]>([]);
  total          = signal(0);
  loading        = signal(false);
  perPage        = 20;
  page           = 1;
  selectedCourseId: number | null = null;

  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min = Math.min;

  ngOnInit(): void {
    this.api.getPaginated<CourseOption>(API.COURSES, { per_page: 200 }).subscribe({
      next:  res => { this.courses.set(res.result.data); this.coursesLoading.set(false); },
      error: ()  => this.coursesLoading.set(false),
    });
  }

  onCourseChange(): void {
    this.page = 1;
    this.items.set([]);
    this.total.set(0);
    if (this.selectedCourseId) this.load();
  }

  load(): void {
    if (!this.selectedCourseId) return;
    this.loading.set(true);
    this.api.getPaginated<Assignment>(courseUrl.assignments(this.selectedCourseId), { page: this.page, per_page: this.perPage })
      .subscribe({
        next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  onPage(p: number): void {
    this.page = p;
    this.load();
  }

  confirmDelete(item: Assignment): void {
    this.confirmService.confirm({
      message: `Delete "${item.title}"?`,
      accept: () => {
        this.api.delete(courseUrl.assignment(this.selectedCourseId!, item.id)).subscribe({
          next: () => { this.messageService.add({ severity: 'success', detail: 'Deleted.' }); this.load(); },
        });
      },
    });
  }
}
