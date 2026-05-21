import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface JobTitle {
  id: number;
  name: string;
  /** Optional because counts are only included when relation is loaded. */
  employees_count?: number;
  learners_count?: number;
  qualifications_count?: number;
  qualifications?: Qualification[];
}

interface Qualification {
  id: number;
  name: string;
}

@Component({
  selector: 'app-job-title-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, SkeletonModule, NasPageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-title-list.component.html',
  styleUrl: './job-title-list.component.scss',
})
export class JobTitleListComponent implements OnInit {
  private api = inject(ApiService);

  constructor() {
    withLocaleReload(() => {
      this.load();
      this.loadQualifications();
    });
  }

  items             = signal<JobTitle[]>([]);
  loading           = signal(true);
  saving            = signal(false);
  allQualifications = signal<Qualification[]>([]);
  filteredQuals     = signal<Qualification[]>([]);
  selectedJobTitle  = signal<JobTitle | null>(null);
  selectedQualIds   = signal<number[]>([]);
  dialogVisible     = signal(false);
  modalSearch       = signal('');

  readonly skeletons = [1, 2, 3, 4, 5, 6];

  ngOnInit(): void {
    this.load();
    this.loadQualifications();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPaginated<JobTitle>(API.JOB_TITLES, { page: 1, per_page: 100 })
      .subscribe({
        next:  res => { this.items.set(res.result.data); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  loadQualifications(): void {
    this.api.get<Qualification[]>(`${API.QUALIFICATIONS}/active`)
      .subscribe({ next: res => {
        this.allQualifications.set(res.result ?? []);
        this.filteredQuals.set(res.result ?? []);
      }});
  }

  openDialog(jobTitle: JobTitle): void {
    this.selectedJobTitle.set(jobTitle);
    this.selectedQualIds.set([]);
    this.modalSearch.set('');
    this.filteredQuals.set(this.allQualifications());
    this.dialogVisible.set(true);
    this.api.get<JobTitle>(`${API.JOB_TITLES}/${jobTitle.id}`)
      .subscribe({ next: res => {
        this.selectedQualIds.set((res.result.qualifications ?? []).map((q: Qualification) => q.id));
      }});
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
    this.selectedJobTitle.set(null);
    this.selectedQualIds.set([]);
    this.modalSearch.set('');
  }

  onModalSearch(term: string): void {
    this.modalSearch.set(term);
    const q = term.toLowerCase();
    this.filteredQuals.set(
      q ? this.allQualifications().filter(x => x.name.toLowerCase().includes(q)) : this.allQualifications()
    );
  }

  toggleQual(id: number): void {
    const current = this.selectedQualIds();
    this.selectedQualIds.set(
      current.includes(id) ? current.filter(x => x !== id) : [...current, id]
    );
  }

  isSelected(id: number): boolean {
    return this.selectedQualIds().includes(id);
  }

  saveQualifications(): void {
    const jt = this.selectedJobTitle();
    if (!jt) return;
    this.saving.set(true);
    this.api.put(`${API.JOB_TITLES}/${jt.id}/qualifications`, { qualification_skill_ids: this.selectedQualIds() })
      .subscribe({
        next:  () => { this.saving.set(false); this.closeDialog(); this.load(); },
        error: () => this.saving.set(false),
      });
  }

}
