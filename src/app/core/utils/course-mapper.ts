import type {
  ApiCourseType,
  Course,
  CourseDetail,
  CourseLearner,
  CourseSession,
  CourseStatus,
  CourseType,
  Cohort,
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
  level?: string;
  price?: number;
  currency?: string;
  max_learners?: number;
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
    max_learners:             raw.max_learners,
    created_at:               raw.created_at,
    updated_at:               raw.updated_at ?? raw.created_at,
    enrolled_count:           raw.enrolled_count ?? raw.users_count ?? 0,
    cohorts_count:            raw.cohorts_count ?? 0,
    completion_percent:       raw.completion_percent,
    rating:                   raw.rating,
    rating_count:             raw.rating_count ?? 0,
    comments_count:           raw.comments_count ?? 0,
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
 * `progress` / `status` aren't tracked on the pivot — they default to
 * `0` / `not_started`, since neither column exists in the `users_courses`
 * schema. Falls back gracefully when fields are missing.
 */
export function mapEnrollmentToLearner(raw: ApiEnrollmentRaw): CourseLearner {
  return {
    id:          raw.id,
    name:        pickLocalized(raw.user?.name, LOCALE, 'Unknown learner'),
    cohort_name: pickLocalized(raw.group?.name, LOCALE, '—'),
    progress:    0,
    status:      'not_started',
    enrolled_at: raw.created_at ?? '',
  };
}

export function mapSessionToCohort(session: CourseSession): Cohort {
  const date = session.session_date ?? '';
  const isFuture = !!date && new Date(date) > new Date();
  return {
    id:         session.id,
    name:       session.title,
    start_date: date,
    end_date:   date,
    enrolled:   0,
    capacity:   0,
    status:     date ? (isFuture ? 'upcoming' : 'active') : 'inactive',
    section_id: session.section?.id,
  };
}
