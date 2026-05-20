import type {
  ApiCourseType,
  Course,
  CourseDetail,
  CourseSession,
  CourseStatus,
  CourseType,
  Cohort,
} from '../models/course.types';

/** Raw shape returned by Laravel CourseDetailResource / CourseResource */
export interface ApiCourseRaw {
  id: number;
  title: string;
  description?: string;
  course_type?: ApiCourseType;
  active?: boolean;
  certificate?: boolean;
  created_at?: string;
  category?: { id: number; name: string };
  instructors?: Array<{ id: number; name: string }>;
  instructor?: { id: number; name: string };
  qualification_skills?: Array<{ id: number; name: string }>;
  sections?: Array<{ id: number; name?: string; title?: string }>;
  users_count?: number;
  [key: string]: unknown;
}

export function mapCourseType(ct?: ApiCourseType): CourseType {
  if (ct === 'online') return 'online';
  return 'offline';
}

export function mapCourseStatus(active?: boolean): CourseStatus {
  return active ? 'active' : 'inactive';
}

export function mapApiCourseListItem(raw: ApiCourseRaw): Course {
  const instructor = raw.instructors?.[0] ?? raw.instructor;
  return {
    id: raw.id,
    title: raw.title,
    type: mapCourseType(raw.course_type),
    course_type: raw.course_type,
    status: mapCourseStatus(raw.active),
    active: raw.active,
    category: raw.category ?? null,
    instructor: instructor ?? null,
    instructors: raw.instructors,
    updated_at: raw.created_at,
  };
}

export function mapApiCourseDetail(raw: ApiCourseRaw): CourseDetail {
  const instructor = raw.instructors?.[0] ?? raw.instructor;
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    type: mapCourseType(raw.course_type),
    status: mapCourseStatus(raw.active),
    instructor,
    instructors: raw.instructors,
    sections: raw.sections?.map(s => ({
      id: s.id,
      name: s.name ?? s.title ?? `Section ${s.id}`,
    })),
    certificate: raw.certificate,
    created_at: raw.created_at,
    qualifications: raw.qualification_skills,
    qualification_skills: raw.qualification_skills,
    enrolled_count: (raw['users_count'] as number | undefined) ?? 0,
    cohorts_count: 0,
    cohorts: [],
  };
}

export function mapSessionToCohort(session: CourseSession): Cohort {
  const date = session.session_date ?? '';
  return {
    id: session.id,
    name: session.title,
    start_date: date,
    end_date: date,
    enrolled: 0,
    capacity: 30,
    status: date && new Date(date) > new Date() ? 'upcoming' : 'active',
    section_id: session.section?.id,
  };
}
