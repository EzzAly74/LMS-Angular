import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { NasStatusBadgeComponent } from '../../../../shared/nas/nas-status-badge.component';
import { ApiService } from '../../../../core/services/api.service';
import { API, courseUrl } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface CourseOption { id: number; title: string; }
interface Exam {
  id: number;
  title: string;
  degree: number;
  is_final: boolean;
  created_at: string;
}

@Component({
  selector: 'app-exam-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DropdownModule, ConfirmDialogModule, SkeletonModule, NasPageHeaderComponent, NasStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exam-list.component.html',
  styleUrl: './exam-list.component.scss',
})
export class ExamListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private t              = inject(TranslateService);

  constructor() {
    withLocaleReload(() => {
      if (this.selectedCourseId) this.load();
    });
  }

  courses        = signal<CourseOption[]>([]);
  coursesLoading = signal(true);
  items          = signal<Exam[]>([]);
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
    this.api.getPaginated<Exam>(courseUrl.exams(this.selectedCourseId), { page: this.page, per_page: this.perPage })
      .subscribe({
        next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  onPage(p: number): void {
    this.page = p;
    this.load();
  }

  confirmDelete(item: Exam): void {
    this.confirmService.confirm({
      message: `${this.t.instant('confirm.delete_message')} (${item.title})`,
      header:  this.t.instant('confirm.delete_title'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.delete(courseUrl.exam(this.selectedCourseId!, item.id)).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', detail: this.t.instant('success.deleted') });
            this.load();
          },
        });
      },
    });
  }
}
