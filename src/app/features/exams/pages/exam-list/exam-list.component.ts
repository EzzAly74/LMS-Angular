import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/services/api.service';
import { API, courseUrl } from '../../../../core/constants/api.constants';

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
  imports: [CommonModule, FormsModule, TranslateModule, TableModule, ButtonModule, InputTextModule, DropdownModule, TagModule, ConfirmDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exam-list.component.html',
})
export class ExamListComponent implements OnInit {
  private api            = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  courses        = signal<CourseOption[]>([]);
  coursesLoading = signal(true);
  items          = signal<Exam[]>([]);
  total          = signal(0);
  loading        = signal(false);
  perPage        = 20;
  page           = 1;
  selectedCourseId: number | null = null;

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

  onPage(event: TableLazyLoadEvent): void {
    this.page = Math.floor((event.first ?? 0) / (event.rows ?? this.perPage)) + 1;
    this.load();
  }

  confirmDelete(item: Exam): void {
    this.confirmService.confirm({
      message: `Delete "${item.title}"?`,
      accept: () => {
        this.api.delete(courseUrl.exam(this.selectedCourseId!, item.id)).subscribe({
          next: () => { this.messageService.add({ severity: 'success', detail: 'Deleted.' }); this.load(); },
        });
      },
    });
  }
}
