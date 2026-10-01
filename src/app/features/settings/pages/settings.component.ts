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
import { ReactiveFormsModule, FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../core/services/api.service';
import { EnumsService } from '../../../core/services/enums.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { API } from '../../../core/constants/api.constants';
// Direct file imports — re-exporting through `index.ts` barrels confuses
// Angular's compile-time `imports: []` resolver and disables template type
// inference (we end up with `$event: Event` on photo-upload handlers).
import { NasIconComponent }        from '../../../shared/nas/nas-icon/nas-icon.component';
import { NasPhotoUploadComponent } from '../../../shared/nas/nas-photo-upload/nas-photo-upload.component';
import { NasRichTextComponent }    from '../../../shared/nas/nas-rich-text/nas-rich-text.component';
import { ToastService } from '../../../core/services/toast.service';
import { NasCanDirective } from '../../../shared/nas/nas-can/nas-can.directive';

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

/**
 * Platform Settings — pixel-perfect Figma implementation (nodes
 * 380:16365, 385:14745, 385:13783, 385:12821).
 *
 * Two sections in one form:
 *   1. Enrolment & Attendance - default_cohort_size, academy close offset,
 *                               attendance toggle, passcode reset
 *   2. Grading & Certificates - certificate_award_basis, min_passing_* (conditional)
 *
 * Three sections were removed on 2026-09-25 (I18N-03): General
 * (platform_name, default_language), About Us (about_*), and the "website
 * view" Settings card (header/footer logo, banner, why_us). Every field in
 * them was edited here and read nowhere - the Angular Website renders none
 * of them, and the human confirmed the mobile app does not use /settings.
 * why_us also stored Arabic hard-coded into one value, which D-051 forbids.
 * The course-ratings toggle went too: no code ever read it (I18N-04). And on
 * 2026-09-26 the abnormal-rating threshold, with ratings leaving the admin
 * side: its only reader was the rating-drop alert, removed with them.
 *
 * Everything lives on the existing `settings` table — text/number/boolean
 * keys go through `PUT /admin/settings`, image keys go through
 * `POST /admin/settings/upload`.
 */
/** The Platform Config number fields and their limits (match the server). */
type NumericSetting = 'default_cohort_size' | 'academy_close_offset_days' | 'passcode_reset_seconds'
  | 'min_passing_attendance' | 'min_passing_score';

const NUMERIC_LIMITS: Record<NumericSetting, { min: number; max: number }> = {
  default_cohort_size:       { min: 1, max: 1000 },
  academy_close_offset_days: { min: 0, max: 365 },
  passcode_reset_seconds:    { min: 1, max: 86400 },
  min_passing_attendance:    { min: 0, max: 100 },
  min_passing_score:         { min: 0, max: 100 },
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    DropdownModule, InputSwitchModule, SkeletonModule,
    NasIconComponent, NasPhotoUploadComponent, NasRichTextComponent, NasCanDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private api       = inject(ApiService);
  private enums     = inject(EnumsService);
  private http      = inject(HttpClient);
  private fb        = inject(FormBuilder);
  private message   = inject(ToastService);
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

  /* ── Dropdown / option data — every list is now backend-driven ───── */

  /**
   * Default-language dropdown. The settings table stores the locale
   * code ("en" / "ar") as a string value, so we bind the dropdown to
   * `optionValue="code"` and keep the form control as a string.
   */
  languageOptions = this.enums.options('locale');

  /**
   * Certificate-award-basis radio cards. The backend enum ships a
   * localized `description` per option (because `certificate_basis`
   * is registered with `desc: true` in `EnumRegistry`), so the cards
   * render fully without any client-side i18n keys.
   */
  certificateOptions = this.enums.options('certificate_basis');

  /**
   * Mirrors `form.certificate_award_basis` so Angular signals can react
   * to it — `computed()` only depends on other signals, not on Form values.
   */
  basisSig = signal<CertificateBasis>('attendance');
  showMinAttendance = computed(() => this.basisSig() === 'attendance' || this.basisSig() === 'both');
  showMinScore = computed(() => this.basisSig() === 'score' || this.basisSig() === 'both');

  /**
   * Mirrors `form.course_attendance_enabled` so the Yes/No segmented control
   * can drive its active state through a signal (Forms values aren't reactive
   * to `computed()` on their own).
   */
  attendanceSig = signal(true);

  /* ── Lifecycle ───────────────────────────────────────────── */
  ngOnInit(): void {
    this.form = this.fb.group({
      default_cohort_size:       [30, this.rangeValidators('default_cohort_size')],
      academy_close_offset_days: [0, this.rangeValidators('academy_close_offset_days')],
      course_attendance_enabled: [true],
      passcode_reset_seconds:    [30, this.rangeValidators('passcode_reset_seconds')],
      certificate_award_basis:   ['attendance' as CertificateBasis],
      min_passing_attendance:    [70, this.rangeValidators('min_passing_attendance')],
      min_passing_score:         [30, this.rangeValidators('min_passing_score')],
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

    // Defend against duplicate rows sharing the same key (e.g. a setting that
    // was historically seeded under two modules). The backend treats the
    // lowest-id row as canonical — it's the one `updateByKey` edits — so we
    // keep the first occurrence by id and ignore any stale later duplicates.
    // Without this, last-row-wins would surface a stale value (the "Course
    // Attendance / Passcode reset shows Yes/30 after save" bug).
    const seen = new Set<string>();
    [...rows].sort((a, b) => a.id - b.id).forEach(row => {
      if (seen.has(row.key)) return;
      seen.add(row.key);
      map[row.key] = row.value;
      if (row.type === 'file' && row.value) {
        previews[row.key] = this.resolvePublicUrl(row.value);
      }
    });

    this.map.set(map);
    this.filePreviews.set(previews);

    const basis = (map['certificate_award_basis'] ?? 'attendance') as CertificateBasis;
    this.basisSig.set(basis);

    const attendanceEnabled = this.boolValue(map['course_attendance_enabled'], true);
    this.attendanceSig.set(attendanceEnabled);

    this.form.patchValue({
      default_cohort_size:       this.numericValue(map['default_cohort_size'], 30),
      academy_close_offset_days: this.numericValue(map['academy_default_close_offset_days'], 0),
      course_attendance_enabled: attendanceEnabled,
      passcode_reset_seconds:    this.numericValue(map['passcode_reset_seconds'], 30),
      certificate_award_basis:   basis,
      min_passing_attendance:    this.numericValue(map['min_passing_attendance'], 70),
      min_passing_score:         this.numericValue(map['min_passing_score'], 30),
    }, { emitEvent: false });
  }

  setBasis(id: CertificateBasis): void {
    this.basisSig.set(id);
    this.form.get('certificate_award_basis')?.setValue(id);
  }

  setAttendance(enabled: boolean): void {
    this.attendanceSig.set(enabled);
    this.form.get('course_attendance_enabled')?.setValue(enabled);
  }

  /* ── Save ────────────────────────────────────────────────── */
  async save(): Promise<void> {
    if (this.saving()) return;
    // Same limits as the server (UpdateSettingsRequest); stop before the
    // request and show every field's reason (NEW2B-6055, NEW2B-6059).
    if (this.invalidFields().length) {
      this.form.markAllAsTouched();
      this.validationShown.set(true);
      document.getElementById(this.invalidFields()[0])?.focus();
      return;
    }
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
      put('default_cohort_size',       f.default_cohort_size);
      put('academy_default_close_offset_days', f.academy_close_offset_days);
      put('course_attendance_enabled', f.course_attendance_enabled ? '1' : '0');
      put('passcode_reset_seconds',    f.passcode_reset_seconds);
      put('certificate_award_basis',   f.certificate_award_basis);
      put('min_passing_attendance',    f.min_passing_attendance);
      put('min_passing_score',         f.min_passing_score);

      const res = await this.api.put<Setting[]>(API.ADMIN_SETTINGS, { settings: payload }).toPromise();
      if (res?.result) this.ingestSettings(res.result);

      this.message.success('platform_settings.saved');
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
  adjust(field: NumericSetting, delta: number): void {
    const ctrl = this.form.get(field);
    if (!ctrl) return;
    // The steppers stay inside the field's limits.
    const { min, max } = this.limit(field);
    const next = Math.round(Number(ctrl.value || 0)) + delta;
    ctrl.setValue(Math.min(max, Math.max(min, next)));
    ctrl.markAsTouched();
  }

  /* ── Validation ─────────────────────────────────────────── */
  /** Set when Save was pressed with an invalid field: show every error. */
  readonly validationShown = signal(false);

  limit(field: NumericSetting): { min: number; max: number } {
    return NUMERIC_LIMITS[field];
  }

  /** The visible numeric fields that hold an invalid value, in page order. */
  private invalidFields(): NumericSetting[] {
    const visible: NumericSetting[] = ['default_cohort_size', 'academy_close_offset_days'];
    if (!this.attendanceSig()) visible.push('passcode_reset_seconds');
    if (this.showMinAttendance()) visible.push('min_passing_attendance');
    if (this.showMinScore()) visible.push('min_passing_score');
    return visible.filter(f => this.form.get(f)?.invalid);
  }

  /** The field's error, once it was touched or Save was pressed. */
  fieldError(field: NumericSetting): string | null {
    const ctrl = this.form?.get(field);
    if (!ctrl || ctrl.valid || !(ctrl.touched || ctrl.dirty || this.validationShown())) return null;
    const { min, max } = this.limit(field);
    return ctrl.hasError('required')
      ? this.translate.instant('platform_settings.errors.required')
      : this.translate.instant('platform_settings.errors.range', { min, max });
  }

  private rangeValidators(field: NumericSetting): ValidatorFn[] {
    const { min, max } = NUMERIC_LIMITS[field];
    const whole: ValidatorFn = c =>
      c.value === null || c.value === '' || Number.isInteger(Number(c.value)) ? null : { whole: true };
    return [Validators.required, Validators.min(min), Validators.max(max), whole];
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
