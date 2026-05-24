/**
 * Type contracts for the 2026 admin Certificates redesign. Mirrors the
 * payload shape returned by `App\Services\Admin\AdminCertificateService`.
 */

export interface CertificateTemplate {
  id: number;
  name: string;
  name_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  /**
   * Note: the backend doesn't expose a public file URL — the file is
   * always streamed through `GET /admin/certificates/template/file`.
   */
  original_filename?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  /** `true` once a real template image has been uploaded. */
  has_file: boolean;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
}

export interface CertificateTemplateStats {
  total_issued: number;
  last_issued_at: string | null;
}

export interface CertificateTemplateOverview {
  template: CertificateTemplate | null;
  stats: CertificateTemplateStats;
  fields: string[];
}

export interface IssuedCertificate {
  user_id: number;
  course_id: number;
  type: 'exam' | 'evaluation' | string;
  employee_id: string | null;
  learner_name: string;
  department?: string | null;
  course_title: string;
  issued_at: string;
}
