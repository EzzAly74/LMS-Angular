import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

interface QualOption {
  id: number;
  name: string;
}

type ResourceType = 'article' | 'link' | 'file';

@Component({
  selector: 'app-resource-add',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DropdownModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-add.component.html',
  styleUrl: './resource-add.component.scss',
})
export class ResourceAddComponent implements OnInit {
  private api    = inject(ApiService);
  private router = inject(Router);

  saving      = signal(false);
  qualOptions = signal<QualOption[]>([]);

  form = {
    title: '',
    type: 'article' as ResourceType,
    content: '',
    url: '',
    file: null as File | null,
    qualification_skill_id: null as number | null,
  };

  typeOptions = [
    { label: 'Article',        value: 'article' as ResourceType },
    { label: 'External Link',  value: 'link'    as ResourceType },
    { label: 'File/Document',  value: 'file'    as ResourceType },
  ];

  ngOnInit(): void {
    this.api.get<QualOption[]>(API.QUALIFICATIONS_ACTIVE).subscribe({
      next: res => this.qualOptions.set(Array.isArray(res.result) ? res.result : []),
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.file = input.files?.[0] ?? null;
  }

  cancel(): void {
    this.router.navigate(['/admin/resources']);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.saving.set(true);

    if (this.form.type === 'file' && this.form.file) {
      const fd = new FormData();
      fd.append('title', this.form.title);
      fd.append('type',  this.form.type);
      fd.append('file',  this.form.file);
      if (this.form.qualification_skill_id != null) {
        fd.append('qualification_skill_id', String(this.form.qualification_skill_id));
      }
      this.api.post(API.LMS_RESOURCES, fd).subscribe({
        next: () => { this.saving.set(false); this.router.navigate(['/admin/resources']); },
        error: () => this.saving.set(false),
      });
    } else {
      const payload: Record<string, unknown> = {
        title: this.form.title,
        type:  this.form.type,
      };
      if (this.form.type === 'article') payload['content'] = this.form.content;
      if (this.form.type === 'link')    payload['url']     = this.form.url;
      if (this.form.qualification_skill_id != null) {
        payload['qualification_skill_id'] = this.form.qualification_skill_id;
      }
      this.api.post(API.LMS_RESOURCES, payload).subscribe({
        next: () => { this.saving.set(false); this.router.navigate(['/admin/resources']); },
        error: () => this.saving.set(false),
      });
    }
  }

  canSubmit(): boolean {
    if (this.saving()) return false;
    if (!this.form.title.trim()) return false;
    if (this.form.type === 'link' && !this.form.url.trim()) return false;
    if (this.form.type === 'file' && !this.form.file)       return false;
    return true;
  }
}
