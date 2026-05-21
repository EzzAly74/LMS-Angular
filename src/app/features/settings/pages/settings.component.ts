import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../core/services/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { API } from '../../../core/constants/api.constants';
// Direct file imports — re-exporting through `index.ts` barrels confuses
// Angular's compile-time `imports:[]` resolver and disables template type
// inference (we end up with `$event: Event` on photo-upload handlers).
import { NasIconComponent }        from '../../../shared/nas/nas-icon.component';
import { NasPhotoUploadComponent } from '../../../shared/nas/nas-photo-upload.component';
import { NasRichTextComponent }    from '../../../shared/nas/nas-rich-text.component';

interface Setting {
  id:    number;
  key:   string;
  value: string | null;
  type:  string;
  label: string;
}

interface UploadResponse {
  key:  string;
  path: string;
  url:  string;
}

type CertificateBasis = 'attendance' | 'score' | 'both';
type LangOption = { label: string; value: string };

/**
 * Platform Settings — pixel-perfect Figma implementation (nodes
 * 380:16365, 385:14745, 385:13783, 385:12821).
 *
 * Six sections in one form:
 *   1. General                — platform_name, default_language
 *   2. Enrolment & Learning   — default_cohort_size
 *   3. Grading & Certificates — course_ratings_enabled, abnormal_rating_threshold,
 *                              certificate_award_basis, min_passing_score (conditional)
 *   4. About Us               — about_description / values / mission / vision (rich text),
 *                              about_image (upload)
 *   5. Settings (website view)— header_logo, banner_background, banner_description,
 *                              why_us, footer_logo
 *
 * Everything lives on the existing `settings` table — text/number/boolean
 * keys go through `PUT /admin/settings`, image keys go through
 * `POST /admin/settings/upload`.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    DropdownModule, InputSwitchModule, SkeletonModule,
    NasIconComponent, NasPhotoUploadComponent, NasRichTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private api       = inject(ApiService);
  private http      = inject(HttpClient);
  private fb        = inject(FormBuilder);
  private message   = inject(MessageService);
  private translate = inject(TranslateService);

  /* ── State ────────────────────────────────────────────────── */
  loading = signal(true);
  saving  = signal(false);

  /** Raw map of all settings (key -> value), updated after every save. */
  private map = signal<Record<string, string | null>>({});

  /** Public URLs for file-type settings keyed by setting key. */
  filePreviews = signal<Record<string, string | null>>({});

  /** Pending file blobs the user picked but hasn't uploaded yet. */
  private pendingUploads = new Map<string, File>();

  form!: FormGroup;

  /* ── Static dropdown / option data ────────────────────────── */
  languageOptions: LangOption[] = [
    { label: 'English', value: 'en' },
    { label: 'العربية', value: 'ar' },
  ];

  certificateOptions: { id: CertificateBasis; label: string; desc: string }[] = [
    { id: 'attendance', label: 'platform_settings.basis_attendance',
      desc: 'platform_settings.basis_attendance_desc' },
    { id: 'score',      label: 'platform_settings.basis_score',
      desc: 'platform_settings.basis_score_desc' },
    { id: 'both',       label: 'platform_settings.basis_both',
      desc: 'platform_settings.basis_both_desc' },
  ];

  /**
   * Mirrors `form.certificate_award_basis` so Angular signals can react
   * to it — `computed()` only depends on other signals, not on Form values.
   */
  basisSig = signal<CertificateBasis>('attendance');
  showMinScore = computed(() => this.basisSig() === 'score' || this.basisSig() === 'both');

  /* ── Lifecycle ───────────────────────────────────────────── */
  ngOnInit(): void {
    this.form = this.fb.group({
      platform_name:             [''],
      default_language:          ['en'],
      default_cohort_size:       [30],
      course_ratings_enabled:    [true],
      abnormal_rating_threshold: [30],
      certificate_award_basis:   ['attendance' as CertificateBasis],
      min_passing_score:         [30],
      about_description:         [''],
      about_values:              [''],
      about_mission:             [''],
      about_vision:              [''],
      banner_description:        [''],
      why_us:                    [''],
    });

    this.load();
  }

  /* ── Data IO ─────────────────────────────────────────────── */
  load(): void {
    this.loading.set(true);
    this.api.get<Setting[]>(API.ADMIN_SETTINGS).subscribe({
      next: res => {
        this.ingestSettings(res.result ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private ingestSettings(rows: Setting[]): void {
    const map: Record<string, string | null> = {};
    const previews: Record<string, string | null> = {};

    rows.forEach(row => {
      map[row.key] = row.value;
      if (row.type === 'file' && row.value) {
        previews[row.key] = this.resolvePublicUrl(row.value);
      }
    });

    this.map.set(map);
    this.filePreviews.set(previews);

    const basis = (map['certificate_award_basis'] ?? 'attendance') as CertificateBasis;
    this.basisSig.set(basis);

    this.form.patchValue({
      platform_name:             map['platform_name']             ?? '',
      default_language:          map['default_language']          ?? 'en',
      default_cohort_size:       this.numericValue(map['default_cohort_size'], 30),
      course_ratings_enabled:    this.boolValue(map['course_ratings_enabled'], true),
      abnormal_rating_threshold: this.numericValue(map['abnormal_rating_threshold'], 30),
      certificate_award_basis:   basis,
      min_passing_score:         this.numericValue(map['min_passing_score'], 30),
      about_description:         map['about_description'] ?? '',
      about_values:              map['about_values']      ?? '',
      about_mission:             map['about_mission']     ?? '',
      about_vision:              map['about_vision']      ?? '',
      banner_description:        map['banner_description'] ?? '',
      why_us:                    map['why_us']             ?? '',
    }, { emitEvent: false });
  }

  setBasis(id: CertificateBasis): void {
    this.basisSig.set(id);
    this.form.get('certificate_award_basis')?.setValue(id);
  }

  /* ── Save ────────────────────────────────────────────────── */
  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);

    try {
      // 1. Upload any pending files first so their paths land in the map.
      for (const [key, file] of this.pendingUploads.entries()) {
        await this.uploadFile(key, file);
      }
      this.pendingUploads.clear();

      // 2. Push text/number/boolean values.
      const payload: Record<string, string> = {};
      const f = this.form.value;
      const put = (k: string, v: unknown) => { payload[k] = v === null || v === undefined ? '' : String(v); };
      put('platform_name',             f.platform_name);
      put('default_language',          f.default_language);
      put('default_cohort_size',       f.default_cohort_size);
      put('course_ratings_enabled',    f.course_ratings_enabled ? '1' : '0');
      put('abnormal_rating_threshold', f.abnormal_rating_threshold);
      put('certificate_award_basis',   f.certificate_award_basis);
      put('min_passing_score',         f.min_passing_score);
      put('about_description',         f.about_description);
      put('about_values',              f.about_values);
      put('about_mission',             f.about_mission);
      put('about_vision',              f.about_vision);
      put('banner_description',        f.banner_description);
      put('why_us',                    f.why_us);

      const res = await this.api.put<Setting[]>(API.ADMIN_SETTINGS, { settings: payload }).toPromise();
      if (res?.result) this.ingestSettings(res.result);

      this.message.add({ severity: 'success', detail: this.translate.instant('platform_settings.saved') });
    } catch {
      // The HTTP error interceptor surfaces its own toast — nothing else to do.
    } finally {
      this.saving.set(false);
    }
  }

  /* ── File handlers ─────────────────────────────────────── */
  onFilePicked(key: string, file: File): void {
    this.pendingUploads.set(key, file);
    // Show an immediate local preview so the user sees the swap before save.
    const reader = new FileReader();
    reader.onload = () => {
      const previews = { ...this.filePreviews(), [key]: reader.result as string };
      this.filePreviews.set(previews);
    };
    reader.readAsDataURL(file);
  }

  onFileCleared(key: string): void {
    this.pendingUploads.delete(key);
    const previews = { ...this.filePreviews(), [key]: null };
    this.filePreviews.set(previews);

    // Persist the clear immediately so the next reload reflects it.
    this.api.put(API.ADMIN_SETTINGS, { settings: { [key]: '' } }).subscribe();
  }

  private uploadFile(key: string, file: File): Promise<void> {
    const fd = new FormData();
    fd.append('key', key);
    fd.append('file', file);
    return new Promise((resolve, reject) => {
      this.http.post<ApiResponse<UploadResponse>>(`${API.ADMIN_SETTINGS}/upload`, fd, {
        headers: new HttpHeaders({ Accept: 'application/json' }),
      }).subscribe({
        next: res => {
          const previews = { ...this.filePreviews(), [key]: res.result.url };
          this.filePreviews.set(previews);
          resolve();
        },
        error: err => reject(err),
      });
    });
  }

  /* ── Stepper handlers ─────────────────────────────────── */
  adjust(field: 'default_cohort_size' | 'abnormal_rating_threshold' | 'min_passing_score',
         delta: number): void {
    const ctrl = this.form.get(field);
    if (!ctrl) return;
    const next = Math.max(0, Number(ctrl.value || 0) + delta);
    ctrl.setValue(next);
  }

  /* ── Helpers ────────────────────────────────────────────── */
  private resolvePublicUrl(raw: string): string {
    if (/^https?:\/\//i.test(raw)) return raw;
    const host = (window as unknown as { __API_HOST__?: string }).__API_HOST__
      ?? (document.querySelector('meta[name="api-host"]') as HTMLMetaElement | null)?.content
      ?? this.deriveApiHost();
    return `${host}/storage/${raw.replace(/^\/+/, '')}`;
  }
  private deriveApiHost(): string {
    // Falls back to the configured API base — same origin used elsewhere.
    return API.SETTINGS.replace(/\/api\/v1\/settings$/, '');
  }
  private numericValue(raw: string | null | undefined, fallback: number): number {
    if (raw === null || raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  private boolValue(raw: string | null | undefined, fallback: boolean): boolean {
    if (raw === null || raw === undefined || raw === '') return fallback;
    return raw === '1' || raw.toLowerCase() === 'true';
  }
}
