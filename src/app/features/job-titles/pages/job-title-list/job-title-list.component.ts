import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

interface JobTitle {
  id: number;
  name: string;
  qualifications?: Qualification[];
  qualifications_count?: number;
}

interface Qualification {
  id: number;
  name: string;
}

@Component({
  selector: 'app-job-title-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, TableModule, ButtonModule, DialogModule, MultiSelectModule, SkeletonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-title-list.component.html',
})
export class JobTitleListComponent implements OnInit {
  private api = inject(ApiService);

  items              = signal<JobTitle[]>([]);
  total              = signal(0);
  loading            = signal(true);
  saving             = signal(false);
  allQualifications  = signal<Qualification[]>([]);
  selectedJobTitle   = signal<JobTitle | null>(null);
  selectedQualIds: number[] = [];
  dialogVisible      = false;
  perPage            = 15;
  page               = 1;

  ngOnInit(): void {
    this.load();
    this.loadQualifications();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<JobTitle>(API.JOB_TITLES, { page: this.page, per_page: this.perPage })
      .subscribe({
        next:  res => { this.items.set(res.result.data); this.total.set(res.result.total); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  loadQualifications(): void {
    this.api.get<Qualification[]>(`${API.QUALIFICATIONS}/active`)
      .subscribe({ next: res => this.allQualifications.set(res.result) });
  }

  onPage(event: TableLazyLoadEvent): void {
    this.page = Math.floor((event.first ?? 0) / (event.rows ?? this.perPage)) + 1;
    this.load();
  }

  openDialog(jobTitle: JobTitle): void {
    this.selectedJobTitle.set(jobTitle);
    this.selectedQualIds = [];
    this.dialogVisible = true;
    // Fetch full details to get currently assigned qualifications
    this.api.get<JobTitle>(`${API.JOB_TITLES}/${jobTitle.id}`)
      .subscribe({ next: res => { this.selectedQualIds = (res.result.qualifications ?? []).map(q => q.id); } });
  }

  closeDialog(): void {
    this.dialogVisible = false;
    this.selectedJobTitle.set(null);
    this.selectedQualIds = [];
  }

  saveQualifications(): void {
    const jt = this.selectedJobTitle();
    if (!jt) return;
    this.saving.set(true);
    this.api.put(`${API.JOB_TITLES}/${jt.id}/qualifications`, { qualification_skill_ids: this.selectedQualIds })
      .subscribe({
        next: () => { this.saving.set(false); this.closeDialog(); this.load(); },
        error: () => this.saving.set(false),
      });
  }
}
