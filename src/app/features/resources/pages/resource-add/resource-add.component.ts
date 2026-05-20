import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { FileUploadModule } from 'primeng/fileupload';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, RouterLink, TranslateModule, ButtonModule, InputTextModule, InputTextareaModule, DropdownModule, FileUploadModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-add.component.html',
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
    { label: 'Article', value: 'article' },
    { label: 'External Link', value: 'link' },
    { label: 'File', value: 'file' },
  ];

  ngOnInit(): void {
    this.api.get<QualOption[]>(`${API.QUALIFICATIONS}/active`)
      .subscribe({ next: res => this.qualOptions.set(Array.isArray(res.result) ? res.result : []) });
  }

  onFileSelect(event: { files: File[] }): void {
    this.form.file = event.files[0] ?? null;
  }

  submit(): void {
    if (!this.form.title.trim() || !this.form.type) return;
    this.saving.set(true);

    if (this.form.type === 'file' && this.form.file) {
      const fd = new FormData();
      fd.append('title', this.form.title);
      fd.append('type', this.form.type);
      fd.append('file', this.form.file);
      if (this.form.qualification_skill_id) fd.append('qualification_skill_id', String(this.form.qualification_skill_id));
      this.api.post(API.LMS_RESOURCES, fd).subscribe({
        next: () => { this.saving.set(false); this.router.navigate(['/admin/resources']); },
        error: () => this.saving.set(false),
      });
    } else {
      const payload: Record<string, unknown> = { title: this.form.title, type: this.form.type };
      if (this.form.type === 'article') payload['content'] = this.form.content;
      if (this.form.type === 'link')    payload['url']     = this.form.url;
      if (this.form.qualification_skill_id) payload['qualification_skill_id'] = this.form.qualification_skill_id;
      this.api.post(API.LMS_RESOURCES, payload).subscribe({
        next: () => { this.saving.set(false); this.router.navigate(['/admin/resources']); },
        error: () => this.saving.set(false),
      });
    }
  }
}
