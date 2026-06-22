import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { DropdownModule } from 'primeng/dropdown';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

type ResourceType = 'article' | 'link' | 'file';

interface QualOption { id: number; name: string; }

/** Simple URL validator — accepts http:// and https:// URLs. */
function urlValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value ?? '').trim();
  if (!v) return null;
  try { new URL(v); return null; } catch { return { url: true }; }
}

@Component({
  selector: 'app-resource-add',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, DropdownModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-add.component.html',
  styleUrl: './resource-add.component.scss',
})
export class ResourceAddComponent implements OnInit, OnDestroy {
  private readonly api    = inject(ApiService);
  private readonly enums  = inject(EnumsService);
  private readonly router = inject(Router);
  private readonly fb     = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  saving      = signal(false);
  qualOptions = signal<QualOption[]>([]);
  /** Holds the selected File — not bindable via FormControl. */
  selectedFile = signal<File | null>(null);
  /** Shown below the dropzone after a submit attempt with no file. */
  fileError    = signal(false);

  /** Resource-type dropdown options — backend `resource_type` enum. */
  typeOptions = this.enums.options('resource_type');

  readonly form = this.fb.group({
    title_en:               ['', [Validators.required, Validators.maxLength(255)]],
    title_ar:               ['', [Validators.required, Validators.maxLength(255)]],
    type:                   ['article' as ResourceType | null, Validators.required],
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

  /** Instant equality — no enum lookup needed. */
  isType(code: ResourceType): boolean { return this.typeCtrl.value === code; }

  constructor() {
    withLocaleReload(() => this.loadQualifications());
  }

  ngOnInit(): void {
    this.loadQualifications();
    // Sync conditional validators whenever type changes.
    this.typeCtrl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.syncConditionalValidators());
    // Apply initial validators for default type 'article'.
    this.syncConditionalValidators();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private syncConditionalValidators(): void {
    const type = this.typeCtrl.value;

    // content: required only for articles
    if (type === 'article') {
      this.contentCtrl.setValidators([Validators.required]);
    } else {
      this.contentCtrl.clearValidators();
    }
    this.contentCtrl.updateValueAndValidity({ emitEvent: false });

    // url: required + valid URL only for links
    if (type === 'link') {
      this.urlCtrl.setValidators([Validators.required, urlValidator]);
    } else {
      this.urlCtrl.clearValidators();
    }
    this.urlCtrl.updateValueAndValidity({ emitEvent: false });
  }

  private loadQualifications(): void {
    this.api.get<QualOption[]>(API.QUALIFICATIONS_ACTIVE).subscribe({
      next: res => this.qualOptions.set(Array.isArray(res.result) ? res.result : []),
    });
  }

  onFileSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedFile.set(file);
    this.fileError.set(false);
  }

  cancel(): void { this.router.navigate(['/admin/resources']); }

  submit(): void {
    // Trigger file error manually (file inputs can't be in FormGroup)
    if (this.isType('file') && !this.selectedFile()) {
      this.fileError.set(true);
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (this.isType('file') && !this.selectedFile()) return;

    this.saving.set(true);
    const v    = this.form.getRawValue();
    const type = v.type!;

    if (type === 'file') {
      const fd = new FormData();
      fd.append('title',    v.title_en!.trim());
      fd.append('title_ar', v.title_ar!.trim());
      fd.append('type',     type);
      fd.append('file',     this.selectedFile()!);
      if (v.qualification_skill_id != null) {
        fd.append('qualification_skill_id', String(v.qualification_skill_id));
      }
      this.api.post(API.LMS_RESOURCES, fd).subscribe({
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
      this.api.post(API.LMS_RESOURCES, payload).subscribe({
        next: () => { this.saving.set(false); this.router.navigate(['/admin/resources']); },
        error: () => this.saving.set(false),
      });
    }
  }
}
