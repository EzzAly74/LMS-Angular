import type {
  ApiCourseType,
  Course,
  CourseDetail,
  CourseLearner,
  CourseLevel,
  CourseStatus,
  CourseType,
  Cohort,
  CohortStatus,
} from '../models/course.types';
import { pickLocalized, displayName, type MaybeLocalized } from './localized';

/**
 * Raw shape returned by Laravel's `CourseResource` / `CourseDetailResource`.
 * The backend already resolves localized fields to plain strings using the
 * `Accept-Language` header, but we still type them as `MaybeLocalized` so the
 * mapper is robust if the contract ever changes.
 */
export interface ApiCourseRaw {
  id: number;
  title: MaybeLocalized;
  description?: MaybeLocalized;
  course_type?: CourseType;
  active?: boolean;
  certificate?: boolean;
  certificate_pass_percent?: number;
  for_public?: boolean;
  is_evaluate?: boolean;
  outside_materials?: boolean;
  allow_attendances?: boolean;
  created_at?: string;
  updated_at?: string;
  hours?: number;
  language?: string;
  /** Backend `course_level` enum code — beginner | intermediate | professional. */
  level?: CourseLevel | string | null;
  price?: number;
  currency?: string;
  max_learners?: number;
  /**
   * Course thumbnail. The detail resource resolves this to a fully-
   * qualified URL via `getFileUrl()` — the list endpoint usually doesn't
   * include it, hence the optional/nullable shape.
   */
  image?: string | null;
  category?: { id: number; name: MaybeLocalized } | null;
  instructors?: Array<{ id: number; name: MaybeLocalized; image?: string | null }>;
  instructor?: { id: number; name: MaybeLocalized } | null;
  qualification_skills?: Array<{ id: number; name: MaybeLocalized }>;
  sections?: Array<{ id: number; name?: MaybeLocalized; title?: MaybeLocalized }>;
  users_count?: number;
  cohorts_count?: number;
  enrolled_count?: number;
  completion_percent?: number;
  rating?: number;
  rating_count?: number;
  comments_count?: number;
  rating_distribution?: number[];
  reviews?: Array<{
    id: number;
    rating: number;
    comment?: string | null;
    user_name?: string;
    user_machine_code?: string | null;
    created_at?: string;
  }>;
  status?: CourseStatus;
  [key: string]: unknown;
}

const LOCALE: 'en' | 'ar' =
  (typeof document !== 'undefined' && document.documentElement.lang === 'ar') ? 'ar' : 'en';

const flattenLocalized = <T extends { name?: MaybeLocalized } | { title?: MaybeLocalized } | undefined | null>(
  rel: T,
  key: 'name' | 'title' = 'name',
): (Omit<NonNullable<T>, 'name' | 'title'> & { name: string }) | null => {
  if (!rel) return null;
  const r = rel as Record<string, unknown>;
  const raw = r[key] as MaybeLocalized;
  const name = pickLocalized(raw, LOCALE, '');
  return { ...(r as object), name } as Omit<NonNullable<T>, 'name' | 'title'> & { name: string };
};

export function mapCourseType(ct?: ApiCourseType | CourseType): CourseType {
  switch (ct) {
    case 'online':
    case 'offline':
    case 'hybrid':
    case 'external_link':
      return ct;
    default:
      return 'offline';
  }
}

/**
 * Lock a raw level value to one of the three canonical buckets. Returns
 * `null` for unknown / missing values so the UI can render an em-dash
 * instead of fabricating a default.
 */
export function mapCourseLevel(level?: string | null): CourseLevel | null {
  switch (level) {
    case 'beginner':
    case 'intermediate':
    case 'professional':
      return level;
    default:
      return null;
  }
}

export function mapCourseStatus(status?: string, active?: boolean): CourseStatus {
  switch (status) {
    case 'active':
    case 'pending':
    case 'upcoming':
    case 'inactive':
      return status;
    default:
      return active ? 'active' : 'inactive';
  }
}

export function mapApiCourseListItem(raw: ApiCourseRaw): Course {
  const instructor = raw.instructors?.[0] ?? raw.instructor ?? null;
  return {
    id:                 raw.id,
    title:              pickLocalized(raw.title, LOCALE, ''),
    type:               mapCourseType(raw.course_type),
    course_type:        raw.course_type === 'online' ? 'online' : 'offline',
    status:             mapCourseStatus(raw.status, raw.active),
    active:             raw.active,
    category:           flattenLocalized(raw.category),
    instructor:         flattenLocalized(instructor),
    instructors:        raw.instructors?.map(i => flattenLocalized(i)!).filter(Boolean) as Course['instructors'],
    cohorts_count:      raw.cohorts_count ?? 0,
    users_count:        raw.users_count ?? 0,
    completion_percent: raw.completion_percent,
    rating:             raw.rating,
    level:              mapCourseLevel(raw.level as string | null | undefined),
    updated_at:         raw.updated_at ?? raw.created_at,
  };
}

export function mapApiCourseDetail(raw: ApiCourseRaw): CourseDetail {
  const instructor = raw.instructors?.[0] ?? raw.instructor ?? null;
  return {
    id:                       raw.id,
    title:                    pickLocalized(raw.title, LOCALE, ''),
    description:              pickLocalized(raw.description, LOCALE, ''),
    type:                     mapCourseType(raw.course_type),
    status:                   mapCourseStatus(raw.status, raw.active),
    category:                 flattenLocalized(raw.category),
    instructor:               flattenLocalized(instructor) ?? undefined,
    instructors:              raw.instructors?.map(i => flattenLocalized(i)!).filter(Boolean) as CourseDetail['instructors'],
    sections:                 raw.sections?.map(s => ({
      id:   s.id,
      name: pickLocalized(s.name ?? s.title, LOCALE, `Section ${s.id}`),
    })),
    qualifications:           raw.qualification_skills?.map(q => flattenLocalized(q)!).filter(Boolean) as CourseDetail['qualifications'],
    qualification_skills:     raw.qualification_skills?.map(q => flattenLocalized(q)!).filter(Boolean) as CourseDetail['qualification_skills'],
    certificate:              raw.certificate,
    certificate_pass_percent: raw.certificate_pass_percent,
    delivery_type:            displayName(raw.course_type, LOCALE, ''),
    level:                    mapCourseLevel(raw.level as string | null | undefined),
    max_learners:             raw.max_learners,
    created_at:               raw.created_at,
    updated_at:               raw.updated_at ?? raw.created_at,
    enrolled_count:           raw.enrolled_count ?? raw.users_count ?? 0,
    cohorts_count:            raw.cohorts_count ?? 0,
    completion_percent:       raw.completion_percent,
    rating:                   raw.rating,
    rating_count:             raw.rating_count ?? 0,
    comments_count:           raw.comments_count ?? 0,
    image:                    raw.image ?? null,
    rating_distribution:      raw.rating_distribution ?? [0, 0, 0, 0, 0],
    reviews:                  (raw.reviews ?? []).map(r => ({
      id:                r.id,
      user_name:         r.user_name ?? 'Unknown',
      user_machine_code: r.user_machine_code ?? '',
      rating:            r.rating,
      comment:           r.comment ?? '',
      created_at:        r.created_at ?? '',
    })),
    cohorts:                  [],
  };
}

/**
 * Raw shape returned by `GET /api/v1/courses/{course}/enrollments`. The
 * backend ships the bare `UsersCourse` pivot row with `user` and `group`
 * eager-loaded, so localized fields arrive as full bilingual JSON.
 */
export interface ApiEnrollmentRaw {
  id: number;
  user_id?: number;
  group_id?: number | null;
  created_at?: string;
  /**
   * Computed inline by the backend (FLOOR(completed_lectures * 100 / total)).
   * MySQL returns `DECIMAL` as a string, so we accept both shapes here.
   */
  progress_percent?: number | string | null;
  user?: {
    id: number;
    name?: MaybeLocalized;
    machine_code?: string;
    department_name?: string;
    image?: string | null;
  } | null;
  group?: {
    id: number;
    name?: MaybeLocalized;
  } | null;
}

/**
 * Map a raw enrollment pivot record into a flat learner row for the table.
 * Progress comes from the backend correlated sub-select; the status is
 * derived locally so the Figma "Completed / In Progress / Not Started"
 * chips don't need a separate column on the wire.
 */
export function mapEnrollmentToLearner(raw: ApiEnrollmentRaw): CourseLearner {
  const progress = Math.max(0, Math.min(100,
    Math.round(Number(raw.progress_percent ?? 0)) || 0,
  ));
  const status: CourseLearner['status'] =
    progress >= 100 ? 'completed'
  : progress > 0   ? 'in_progress'
  :                  'not_started';

  return {
    id:          raw.id,
    name:        pickLocalized(raw.user?.name, LOCALE, 'Unknown learner'),
    cohort_name: pickLocalized(raw.group?.name, LOCALE, '—'),
    progress,
    status,
    enrolled_at: raw.created_at ?? '',
  };
}

/**
 * Raw cohort row (CourseSectionResource) — the Cohort tab on the course
 * detail screen reads cohorts straight from `course_sections` now, so
 * this maps the new resource shape into the slimmer `Cohort` interface
 * the UI binds to.
 */
export interface ApiCohortRaw {
  id: number;
  course_id?: number;
  name?: MaybeLocalized;
  name_translations?: { en?: string | null; ar?: string | null };
  start_date?: string | null;
  end_date?:   string | null;
  capacity?:   number | null;
  status?:     string | null;
  enrolled_count?: number;
}

/**
 * Lock a raw status value to one of the four canonical buckets. Anything
 * unrecognised defaults to `scheduled` so the chip still has something to
 * render rather than turning into an empty pill.
 */
function normalizeCohortStatus(s: string | null | undefined): CohortStatus {
  switch (s) {
    case 'active':
    case 'completed':
    case 'inactive':
      return s;
    default:
      return 'scheduled';
  }
}

export function mapApiCohort(raw: ApiCohortRaw): Cohort {
  return {
    id:         raw.id,
    name:       pickLocalized(raw.name, LOCALE, ''),
    name_en:    raw.name_translations?.en ?? null,
    name_ar:    raw.name_translations?.ar ?? null,
    start_date: raw.start_date ?? null,
    end_date:   raw.end_date ?? null,
    enrolled:   Number(raw.enrolled_count ?? 0),
    capacity:   raw.capacity ?? null,
    status:     normalizeCohortStatus(raw.status),
    // Kept as an alias so the attendance drawer (which still reads
    // `cohort.section_id`) keeps working — cohort.id IS the section id.
    section_id: raw.id,
  };
}
