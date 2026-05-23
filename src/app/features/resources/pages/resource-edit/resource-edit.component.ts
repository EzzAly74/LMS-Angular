import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

interface LmsResource {
  id: number;
  title: string;
  type: 'article' | 'link' | 'file';
  content?: string | null;
  url?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  qualification?: { id: number; name: string } | null;
  qualification_skill_id?: number | null;
  created_at: string;
}

interface QualOption {
  id: number;
  name: string;
}

type ResourceType = 'article' | 'link' | 'file';

@Component({
  selector: 'app-resource-edit',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DropdownModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-edit.component.html',
  styleUrl: './resource-edit.component.scss',
})
export class ResourceEditComponent implements OnInit {
  private api    = inject(ApiService);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);

  loading     = signal(true);
  saving      = signal(false);
  resource    = signal<LmsResource | null>(null);
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
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }

    this.api.get<QualOption[]>(API.QUALIFICATIONS_ACTIVE)
      .subscribe({ next: res => this.qualOptions.set(Array.isArray(res.result) ? res.result : []) });

    this.api.get<LmsResource>(`${API.LMS_RESOURCES}/${id}`).subscribe({
      next: res => {
        const r = res.result as LmsResource;
        this.resource.set(r);
        this.form.title                 = r.title;
        this.form.type                  = r.type;
        this.form.content               = r.content ?? '';
        this.form.url                   = r.url ?? '';
        this.form.qualification_skill_id = r.qualification?.id ?? null;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.file = input.files?.[0] ?? null;
  }

  cancel(): void {
    this.router.navigate(['/admin/resources']);
  }

  save(): void {
    if (!this.form.title.trim()) return;
    const r = this.resource();
    if (!r) return;

    this.saving.set(true);

    if (this.form.type === 'file' && this.form.file) {
      const fd = new FormData();
      fd.append('title', this.form.title);
      fd.append('type', this.form.type);
      fd.append('_method', 'PUT');
      fd.append('file', this.form.file);
      if (this.form.qualification_skill_id != null) {
        fd.append('qualification_skill_id', String(this.form.qualification_skill_id));
      }
      this.api.post(`${API.LMS_RESOURCES}/${r.id}`, fd).subscribe({
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
      this.api.put<LmsResource>(`${API.LMS_RESOURCES}/${r.id}`, payload).subscribe({
        next: () => { this.saving.set(false); this.router.navigate(['/admin/resources']); },
        error: () => this.saving.set(false),
      });
    }
  }
}
