import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
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
  title_ar?: string | null;
  type: 'article' | 'link' | 'file';
  content?: string | null;
  content_ar?: string | null;
  url?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  qualification?: { id: number; name: string } | null;
  created_at: string;
}

interface QualOption { id: number; name: string; }

type ResourceType = 'article' | 'link' | 'file';

/** Simple URL validator — accepts http:// and https:// URLs. */
function urlValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value ?? '').trim();
  if (!v) return null;
  try { new URL(v); return null; } catch { return { url: true }; }
}

@Component({
  selector: 'app-resource-edit',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, DropdownModule, SkeletonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-edit.component.html',
  styleUrl: './resource-edit.component.scss',
})
export class ResourceEditComponent implements OnInit, OnDestroy {
  private readonly api      = inject(ApiService);
  private readonly enums    = inject(EnumsService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly fb       = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  loading      = signal(true);
  saving       = signal(false);
  resource     = signal<LmsResource | null>(null);
  qualOptions  = signal<QualOption[]>([]);
  selectedFile = signal<File | null>(null);
  fileError    = signal(false);

  typeOptions = this.enums.options('resource_type');

  readonly form = this.fb.group({
    title_en:               ['', [Validators.required, Validators.maxLength(255)]],
    title_ar:               ['', [Validators.required, Validators.maxLength(255)]],
    type:                   [null as ResourceType | null, Validators.required],
    content:                [''],
    content_ar:             [''],
    url:                    [''],
    qualification_skill_id: [null as number | null],
  });

  get titleEnCtrl()  { return this.form.controls.title_en; }
  get titleArCtrl()  { return this.form.controls.title_ar; }
  get typeCtrl()     { return this.form.controls.type; }
  get contentCtrl()  { return this.form.controls.content; }
  get urlCtrl()      { return this.form.controls.url; }

  isType(code: ResourceType): boolean { return this.typeCtrl.value === code; }

  constructor() {
    withLocaleReload(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) { this.loadQualifications(); this.loadResource(id); }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }

    // Sync conditional validators whenever type changes.
    this.typeCtrl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.syncConditionalValidators());

    this.loadQualifications();
    this.loadResource(id);
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private syncConditionalValidators(): void {
    const type = this.typeCtrl.value;

    if (type === 'article') {
      this.contentCtrl.setValidators([Validators.required]);
    } else {
      this.contentCtrl.clearValidators();
    }
    this.contentCtrl.updateValueAndValidity({ emitEvent: false });

    if (type === 'link') {
      this.urlCtrl.setValidators([Validators.required, urlValidator]);
    } else {
      this.urlCtrl.clearValidators();
    }
    this.urlCtrl.updateValueAndValidity({ emitEvent: false });
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
        this.form.patchValue({
          title_en:               r.title ?? '',
          title_ar:               r.title_ar ?? '',
          type:                   r.type ?? null,
          content:                r.content ?? '',
          content_ar:             r.content_ar ?? '',
          url:                    r.url ?? '',
          qualification_skill_id: r.qualification?.id ?? null,
        });
        // Apply validators that match the loaded type.
        this.syncConditionalValidators();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFileSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedFile.set(file);
    this.fileError.set(false);
  }

  cancel(): void { this.router.navigate(['/admin/resources']); }

  save(): void {
    // File required only for new file-type resources (no existing file)
    const needsFile = this.isType('file') && !this.resource()?.file_name && !this.selectedFile();
    if (needsFile) this.fileError.set(true);

    this.form.markAllAsTouched();
    if (this.form.invalid || needsFile) return;

    const r = this.resource();
    if (!r) return;

    this.saving.set(true);
    const v    = this.form.getRawValue();
    const type = v.type!;

    if (type === 'file' && this.selectedFile()) {
      const fd = new FormData();
      fd.append('title',    v.title_en!.trim());
      fd.append('title_ar', v.title_ar!.trim());
      fd.append('type',     type);
      fd.append('_method',  'PUT');
      fd.append('file',     this.selectedFile()!);
      if (v.qualification_skill_id != null) {
        fd.append('qualification_skill_id', String(v.qualification_skill_id));
      }
      this.api.post(`${API.LMS_RESOURCES}/${r.id}`, fd).subscribe({
        next: () => { this.saving.set(false); this.router.navigate(['/admin/resources']); },
        error: () => this.saving.set(false),
      });
    } else {
      const payload: Record<string, unknown> = {
        title:    v.title_en!.trim(),
        title_ar: v.title_ar!.trim(),
        type,
      };
      if (type === 'article') {
        payload['content']    = v.content ?? '';
        payload['content_ar'] = v.content_ar ?? '';
      }
      if (type === 'link') payload['url'] = v.url;
      if (v.qualification_skill_id != null) {
        payload['qualification_skill_id'] = v.qualification_skill_id;
      }
      this.api.put<LmsResource>(`${API.LMS_RESOURCES}/${r.id}`, payload).subscribe({
        next: () => { this.saving.set(false); this.router.navigate(['/admin/resources']); },
        error: () => this.saving.set(false),
      });
    }
  }
}
