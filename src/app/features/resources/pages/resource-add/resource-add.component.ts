import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { ApiService } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface QualOption {
  id: number;
  name: string;
}

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
  private enums  = inject(EnumsService);
  private router = inject(Router);

  saving      = signal(false);
  qualOptions = signal<QualOption[]>([]);

  /**
   * The resource type dropdown holds the numeric enum id — the backend's
   * `LmsResourceRequest::AcceptsEnumIds` trait normalizes it back to the
   * string code (`"article"` / `"link"` / `"file"`) before validation
   * runs.
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

  constructor() {
    // Qualifications come back localized — re-pull when the UI language
    // switches so the dropdown labels match the user's locale.
    withLocaleReload(() => this.loadQualifications());
  }

  ngOnInit(): void {
    this.loadQualifications();
    // Default to "article" once the enum has loaded. The effect is
    // intentionally one-shot — once the form has a non-null type the
    // user owns the value.
    this.enums.fetchOnce('resource_type').subscribe(opts => {
      if (this.form.type === null) {
        this.form.type = opts.find(o => o.code === 'article')?.id ?? opts[0]?.id ?? null;
      }
    });
  }

  /** Translate the form's numeric type id back to its string code. */
  private typeCode(): 'article' | 'link' | 'file' | null {
    return this.enums.codeForId('resource_type', this.form.type) as 'article' | 'link' | 'file' | null;
  }

  /** Template helper — used by `@if` blocks that key on the type code. */
  isType(code: 'article' | 'link' | 'file'): boolean {
    return this.typeCode() === code;
  }

  private loadQualifications(): void {
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

    const typeId = this.form.type;
    const typeCode = this.typeCode();

    if (typeCode === 'file' && this.form.file) {
      const fd = new FormData();
      fd.append('title', this.form.title);
      // Send the numeric enum id; backend trait translates it to the
      // string code for the validator + storage column.
      fd.append('type',  String(typeId ?? ''));
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
        type:  typeId,
      };
      if (typeCode === 'article') payload['content'] = this.form.content;
      if (typeCode === 'link')    payload['url']     = this.form.url;
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
    const typeCode = this.typeCode();
    if (!typeCode) return false;
    if (typeCode === 'link' && !this.form.url.trim()) return false;
    if (typeCode === 'file' && !this.form.file)       return false;
    return true;
  }
}
