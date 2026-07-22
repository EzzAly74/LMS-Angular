import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subject, Subscription, debounceTime, takeUntil } from 'rxjs';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { TranslateModule } from '@ngx-translate/core';
import { EnumsService } from '../../../../core/services/enums.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasPhotoUploadComponent } from '../../../../shared/nas/nas-photo-upload/nas-photo-upload.component';
import { NasRichTextComponent } from '../../../../shared/nas/nas-rich-text/nas-rich-text.component';
import { BlogsApiService } from '../../services/blogs-api.service';
import { AdminBlog, AdminBlogSection, QualificationOption, UserOption } from '../../models/blog.types';

@Component({
  selector: 'app-blog-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    DropdownModule,
    MultiSelectModule,
    TranslateModule,
    NasPhotoUploadComponent,
    NasRichTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './blog-form.component.html',
  styleUrl: './blog-form.component.scss',
})
export class BlogFormComponent implements OnInit, OnDestroy {
  private readonly api = inject(BlogsApiService);
  private readonly enums = inject(EnumsService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();
  private readonly userSearch$ = new Subject<string>();
  private userSearchSub?: Subscription;

  readonly isEdit = signal(false);
  private blogId: number | null = null;

  saving = signal(false);
  loading = signal(false);
  coverError = signal(false);

  /** Cover image state (File not bindable via FormControl). */
  coverFile = signal<File | null>(null);
  coverPreview = signal<string | null>(null);

  levelOptions = this.enums.options('course_level');
  qualOptions = signal<QualificationOption[]>([]);
  userOptions = signal<UserOption[]>([]);

  readonly form = this.fb.group({
    title_en: ['', [Validators.required, Validators.maxLength(255)]],
    title_ar: ['', [Validators.required, Validators.maxLength(255)]],
    subtitle_en: [''],
    subtitle_ar: [''],
    level: [null as string | null, Validators.required],
    author_user_id: [null as number | null],
    is_anonymous: [false],
    reading_time: [null as number | null, [Validators.required, Validators.min(1)]],
    qualification_skill_ids: [[] as number[]],
    sections: this.fb.array<FormGroup>([]),
  });

  get sections(): FormArray<FormGroup> {
    return this.form.controls.sections;
  }

  constructor() {
    withLocaleReload(() => this.loadLookups());
  }

  ngOnInit(): void {
    this.loadLookups();

    // Owner requiredness follows the "Anonymous" toggle.
    this.form.controls.is_anonymous.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((anon) => this.syncOwnerValidators(!!anon));
    this.syncOwnerValidators(false);

    // Debounced server-side owner search.
    this.userSearchSub = this.userSearch$
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((q) => this.fetchUsers(q));

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEdit.set(true);
      this.blogId = Number(idParam);
      this.loadBlog(this.blogId);
    } else {
      this.addSection();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Lookups ──────────────────────────────────────────────────── */

  private loadLookups(): void {
    this.api.qualifications().subscribe((opts) => this.qualOptions.set(opts));
    this.fetchUsers();
  }

  private fetchUsers(search?: string): void {
    this.api.users(search).subscribe((users) => {
      // Preserve the currently-selected owner even if it's outside the search page.
      const selectedId = this.form.controls.author_user_id.value;
      const merged = [...users];
      if (selectedId && !merged.some((u) => u.id === selectedId)) {
        const current = this.userOptions().find((u) => u.id === selectedId);
        if (current) merged.unshift(current);
      }
      this.userOptions.set(merged);
    });
  }

  onUserFilter(event: { filter: string }): void {
    this.userSearch$.next(event.filter);
  }

  private syncOwnerValidators(anonymous: boolean): void {
    const ctrl = this.form.controls.author_user_id;
    if (anonymous) {
      ctrl.clearValidators();
      ctrl.setValue(null);
      ctrl.disable({ emitEvent: false });
    } else {
      ctrl.setValidators([Validators.required]);
      ctrl.enable({ emitEvent: false });
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  /* ── Edit preload ─────────────────────────────────────────────── */

  private loadBlog(id: number): void {
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (res) => {
        this.patchFromBlog(res.result);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/admin/blogs']);
      },
    });
  }

  private patchFromBlog(b: AdminBlog): void {
    this.form.patchValue({
      title_en: b.title?.en ?? '',
      title_ar: b.title?.ar ?? '',
      subtitle_en: b.subtitle?.en ?? '',
      subtitle_ar: b.subtitle?.ar ?? '',
      level: b.level,
      author_user_id: b.author_user_id,
      is_anonymous: b.is_anonymous,
      reading_time: b.reading_time,
      qualification_skill_ids: b.qualification_skill_ids ?? [],
    });
    this.syncOwnerValidators(b.is_anonymous);

    this.coverPreview.set(b.image_url);

    if (b.author_user_id && b.author_name) {
      this.userOptions.set([{ id: b.author_user_id, name: b.author_name }]);
    }

    this.sections.clear();
    const list = b.sections?.length ? b.sections : [null];
    list.forEach((s) => this.addSection(s ?? undefined));
  }

  /* ── Sections ─────────────────────────────────────────────────── */

  private buildSection(data?: AdminBlogSection): FormGroup {
    return this.fb.group({
      id: [data?.id ?? null],
      title_en: [data?.title?.en ?? '', [Validators.required, Validators.maxLength(255)]],
      title_ar: [data?.title?.ar ?? '', [Validators.required, Validators.maxLength(255)]],
      body_en: [data?.body?.en ?? '', Validators.required],
      body_ar: [data?.body?.ar ?? '', Validators.required],
      quote_en: [data?.quote?.en ?? ''],
      quote_ar: [data?.quote?.ar ?? ''],
      existing_image: [data?.image ?? null],
      image_file: [null as File | null],
      image_preview: [data?.image_url ?? null],
    });
  }

  addSection(data?: AdminBlogSection): void {
    this.sections.push(this.buildSection(data));
  }

  removeSection(index: number): void {
    this.sections.removeAt(index);
  }

  /* ── Image handling ───────────────────────────────────────────── */

  onCoverSelected(file: File): void {
    this.coverFile.set(file);
    this.coverError.set(false);
    this.readPreview(file).then((url) => this.coverPreview.set(url));
  }

  onCoverCleared(): void {
    this.coverFile.set(null);
    this.coverPreview.set(null);
  }

  onSectionImageSelected(index: number, file: File): void {
    const group = this.sections.at(index);
    group.patchValue({ image_file: file });
    this.readPreview(file).then((url) => group.patchValue({ image_preview: url }));
  }

  onSectionImageCleared(index: number): void {
    const group = this.sections.at(index);
    group.patchValue({ image_file: null, image_preview: null, existing_image: null });
  }

  private readPreview(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  /* ── Submit ───────────────────────────────────────────────────── */

  cancel(): void {
    this.router.navigate(['/admin/blogs']);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (!this.isEdit() && !this.coverFile()) this.coverError.set(true);

    if (this.form.invalid) return;
    if (!this.isEdit() && !this.coverFile()) return;

    const fd = this.buildFormData();
    this.saving.set(true);

    const req$ = this.isEdit()
      ? this.api.update(this.blogId!, fd)
      : this.api.create(fd);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/admin/blogs']);
      },
      error: () => this.saving.set(false),
    });
  }

  private buildFormData(): FormData {
    const v = this.form.getRawValue();
    const fd = new FormData();

    fd.append('title[en]', (v.title_en ?? '').trim());
    fd.append('title[ar]', (v.title_ar ?? '').trim());
    if (v.subtitle_en?.trim()) fd.append('subtitle[en]', v.subtitle_en.trim());
    if (v.subtitle_ar?.trim()) fd.append('subtitle[ar]', v.subtitle_ar.trim());

    if (v.level) fd.append('level', v.level);
    fd.append('is_anonymous', v.is_anonymous ? '1' : '0');
    if (!v.is_anonymous && v.author_user_id != null) {
      fd.append('author_user_id', String(v.author_user_id));
    }
    if (v.reading_time != null) fd.append('reading_time', String(v.reading_time));
    (v.qualification_skill_ids ?? []).forEach((id) => {
      fd.append('qualification_skill_ids[]', String(id));
    });
    fd.append('active', '1');

    if (this.coverFile()) fd.append('image', this.coverFile()!);

    (v.sections as Array<Record<string, unknown>>).forEach((s, i) => {
      if (s['id'] != null) fd.append(`sections[${i}][id]`, String(s['id']));
      fd.append(`sections[${i}][title][en]`, String(s['title_en'] ?? '').trim());
      fd.append(`sections[${i}][title][ar]`, String(s['title_ar'] ?? '').trim());
      fd.append(`sections[${i}][body][en]`, String(s['body_en'] ?? ''));
      fd.append(`sections[${i}][body][ar]`, String(s['body_ar'] ?? ''));
      const qEn = String(s['quote_en'] ?? '').trim();
      const qAr = String(s['quote_ar'] ?? '').trim();
      if (qEn) fd.append(`sections[${i}][quote][en]`, qEn);
      if (qAr) fd.append(`sections[${i}][quote][ar]`, qAr);
      fd.append(`sections[${i}][sort_order]`, String(i));

      const file = s['image_file'] as File | null;
      const existing = s['existing_image'] as string | null;
      if (file) {
        fd.append(`sections[${i}][image]`, file);
      } else if (existing) {
        fd.append(`sections[${i}][image]`, existing);
      }
    });

    return fd;
  }
}
