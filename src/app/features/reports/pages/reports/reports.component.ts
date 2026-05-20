import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { CardModule } from 'primeng/card';
import { HttpClient } from '@angular/common/http';
import { API } from '../../../../core/constants/api.constants';

interface ReportType {
  key: string;
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, TranslateModule, ButtonModule, TabViewModule, CardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  private http = inject(HttpClient);

  downloading = signal<Record<string, boolean | undefined>>({});

  readonly reportTypes: ReportType[] = [
    {
      key: 'compliance-by-job-title',
      label: 'Compliance by Job Title',
      description: 'View compliance rates broken down by job title across your organisation.',
      icon: 'pi pi-briefcase',
    },
    {
      key: 'individual-compliance',
      label: 'Individual Compliance',
      description: 'Track individual learner compliance status against required qualifications.',
      icon: 'pi pi-user-edit',
    },
    {
      key: 'attendance',
      label: 'Attendance',
      description: 'Report on learner attendance across all courses and sessions.',
      icon: 'pi pi-calendar',
    },
    {
      key: 'completion',
      label: 'Completion',
      description: 'Monitor course completion rates across all enrolled learners.',
      icon: 'pi pi-check-circle',
    },
    {
      key: 'scores',
      label: 'Scores',
      description: 'Review quiz and exam scores by course and learner.',
      icon: 'pi pi-star',
    },
    {
      key: 'certificate-status',
      label: 'Certificate Status',
      description: 'Check certificate issuance and expiry status across the platform.',
      icon: 'pi pi-certificate',
    },
  ];

  exportCsv(type: string): void {
    this.downloading.update(d => ({ ...d, [type]: true }));
    const url = `${API.REPORTS}/${type}?format=csv`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = `${type}-report.csv`;
        a.click();
        URL.revokeObjectURL(objectUrl);
        this.downloading.update(d => ({ ...d, [type]: false }));
      },
      error: () => {
        this.downloading.update(d => ({ ...d, [type]: false }));
      },
    });
  }
}
