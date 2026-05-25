import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

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
  imports: [CommonModule, RouterLink, FormsModule, DropdownModule, SkeletonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-edit.component.html',
  styleUrl: './resource-edit.component.scss',
})
export class ResourceEditComponent implements OnInit {
  private api    = inject(ApiService);
  private enums  = inject(EnumsService);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);

  loading     = signal(true);
  saving      = signal(false);
  resource    = signal<LmsResource | null>(null);
  qualOptions = signal<QualOption[]>([]);

  /**
   * The type dropdown is bound to the numeric enum id; backend's
   * `LmsResourceRequest::AcceptsEnumIds` trait normalizes it back to
   * the string code on the way in.
   */
  form = {
    title: '',
    type: null as number | null,
    content: '',
    url: '',
    file: null as File | null,
    qualification_skill_id: null as number | null,
  };

  /** Resource-type dropdown options — backend `resource_type` enum. */
  typeOptions = this.enums.options('resource_type');

  /** Translate the form's numeric type id back to its string code. */
  private typeCode(): ResourceType | null {
    return this.enums.codeForId('resource_type', this.form.type) as ResourceType | null;
  }

  /** Template helper for the conditional content blocks. */
  isType(code: ResourceType): boolean {
    return this.typeCode() === code;
  }

  constructor() {
    // Resource title + qualification name are localized — re-fetch both
    // on language switch so the form pre-fills with the right copy.
    withLocaleReload(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.loadQualifications();
        this.loadResource(id);
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    this.loadQualifications();
    this.loadResource(id);
  }

  private loadQualifications(): void {
    this.api.get<QualOption[]>(API.QUALIFICATIONS_ACTIVE)
      .subscribe({ next: res => this.qualOptions.set(Array.isArray(res.result) ? res.result : []) });
  }

  private loadResource(id: string): void {
    this.loading.set(true);
    this.api.get<LmsResource>(`${API.LMS_RESOURCES}/${id}`).subscribe({
      next: res => {
        const r = res.result as LmsResource;
        this.resource.set(r);
        this.form.title                 = r.title;
        // Translate the backend's string `type` into the numeric enum id
        // the dropdown is bound to. Fall through to null if the enum
        // hasn't loaded yet — `EnumsService` will fill it in shortly,
        // and the next change-detection cycle picks up the new value.
        this.form.type                  = this.enums.idForCode('resource_type', r.type);
        this.form.content               = r.content ?? '';
        this.form.url                   = r.url ?? '';
        this.form.qualification_skill_id = r.qualification?.id ?? null;
        this.loading.set(false);
        // Re-attempt the id-from-code lookup once the enum lands. Covers
        // the cold-cache path where the resource detail returns before
        // the enum options finish fetching.
        if (this.form.type === null) {
          this.enums.fetchOnce('resource_type').subscribe(opts => {
            this.form.type = opts.find(o => o.code === r.type)?.id ?? null;
          });
        }
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

    const typeId = this.form.type;
    const typeCode = this.typeCode();
    if (!typeCode) return;

    this.saving.set(true);

    if (typeCode === 'file' && this.form.file) {
      const fd = new FormData();
      fd.append('title', this.form.title);
      // Send the numeric enum id — backend trait translates to the
      // string code before validation.
      fd.append('type', String(typeId ?? ''));
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
        type:  typeId,
      };
      if (typeCode === 'article') payload['content'] = this.form.content;
      if (typeCode === 'link')    payload['url']     = this.form.url;
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
