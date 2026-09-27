/**
 * Add / Edit Course modal (D6, Figma 2401:126596 / 2401:126340) - the slice of
 * GET /courses/:id the modal reads, and its limits (mirrors CourseRequest).
 */

export type CertificateBasis = 'attendance' | 'score' | 'both';
export type CertificateRule = 'general' | CertificateBasis;

export interface Localized {
  en?: string | null;
  ar?: string | null;
}

export interface LocalizedList {
  en?: string[] | null;
  ar?: string[] | null;
}

export interface CourseFormSource {
  id: number;
  title: Localized | string | null;
  description: Localized | string | null;
  course_type: string | null;
  level: string | null;
  category?: { id: number } | null;
  instructors?: { id: number }[] | null;
  qualification_skills?: { id: number }[] | null;
  what_students_will_learn?: LocalizedList | null;
  requirements?: LocalizedList | null;
  image: string | null;
  certificate_rule?: CertificateRule | null;
  certificate_min_attendance?: number | null;
  certificate_min_score?: number | null;
}

export interface LookupOption {
  id: number;
  name: string;
}

export const TITLE_MAX = 255;
export const TEXT_MAX = 10000;
export const POINT_MAX = 500;
export const POINTS_MAX = 50;
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
/** No SVG (D-044): it is a script-capable document, not a photo. */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
/** Figma's default for both thresholds. */
export const DEFAULT_THRESHOLD = 70;
