import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SkeletonModule } from 'primeng/skeleton';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';

interface LmsResource {
  id: number;
  title: string;
  type: 'article' | 'link' | 'file';
  content?: string;
  url?: string;
  /** Public URL Laravel exposes as `file_path` from `LmsResourceResource`. */
  file_path?: string;
  /** Backwards-compat alias (older responses used `file_url`). */
  file_url?: string;
  file_name?: string;
  file_size?: number;
  qualification?: { id: number; name: string } | null;
  qualification_skill_id?: number;
  created_at: string;
  updated_at?: string;
}

@Component({
  selector: 'app-resource-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, ButtonModule, TagModule, InputTextModule, InputTextareaModule, SkeletonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-detail.component.html',
})
export class ResourceDetailComponent implements OnInit {
  private api   = inject(ApiService);
  private route = inject(ActivatedRoute);

  loading  = signal(true);
  saving   = signal(false);
  editing  = signal(false);
  resource = signal<LmsResource | null>(null);

  editForm = { title: '', content: '', url: '' };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    this.api.get<LmsResource>(`${API.LMS_RESOURCES}/${id}`).subscribe({
      next:  res => { this.resource.set(res.result); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  startEdit(): void {
    const r = this.resource();
    if (!r) return;
    this.editForm = { title: r.title, content: r.content ?? '', url: r.url ?? '' };
    this.editing.set(true);
  }

  cancelEdit(): void { this.editing.set(false); }

  save(): void {
    const r = this.resource();
    if (!r) return;
    this.saving.set(true);
    const payload: Record<string, unknown> = { title: this.editForm.title };
    if (r.type === 'article') payload['content'] = this.editForm.content;
    if (r.type === 'link')    payload['url']     = this.editForm.url;

    this.api.put<LmsResource>(`${API.LMS_RESOURCES}/${r.id}`, payload).subscribe({
      next: res => {
        this.resource.set(res.result);
        this.saving.set(false);
        this.editing.set(false);
      },
      error: () => this.saving.set(false),
    });
  }
}
