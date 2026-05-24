import type { LocalizedText } from './localized.types';

export type CourseStatus = 'active' | 'pending' | 'upcoming' | 'inactive';
export type CourseType   = 'online' | 'offline' | 'hybrid' | 'external_link';
export type ApiCourseType = 'online' | 'offline';

export interface Course {
  id: number;
  title: string;
  category?: { id: number; name: string } | null;
  instructor?: { id: number; name: string } | null;
  instructors?: Array<{ id: number; name: string }>;
  cohorts_count?: number;
  users_count?: number;
  completion_percent?: number;
  rating?: number;
  type?: CourseType;
  course_type?: ApiCourseType;
  status?: CourseStatus;
  active?: boolean;
  updated_at?: string;
}

export interface CourseSection {
  id: number;
  name?: string;
  title?: string;
}

export interface CourseSession {
  id: number;
  course_id: number;
  title: string;
  session_date?: string | null;
  time_from?: string | null;
  time_to?: string | null;
  location?: string | null;
  section?: { id: number; name: string };
}

/**
 * Canonical cohort status values stored on the backend. The table chip in
 * the Cohort tab maps `scheduled` → "Up Coming" when the start_date is in
 * the future, so the display label diverges from the storage label.
 */
export type CohortStatus = 'scheduled' | 'active' | 'completed' | 'inactive';

export interface Cohort {
  id: number;
  /** Localized display name (already resolved server-side via Accept-Language). */
  name: string;
  /** Raw bilingual pair so the edit dialog can prefill both inputs. */
  name_en?: string | null;
  name_ar?: string | null;
  start_date: string | null;
  end_date:   string | null;
  enrolled: number;
  capacity: number | null;
  status: CohortStatus;
  /**
   * @deprecated — kept for backwards compatibility with the attendance
   * drawer that currently reads `cohort.section_id`. Equal to `id`.
   */
  section_id?: number;
}

/** Payload accepted by POST/PUT /courses/{course}/sections. */
export interface CohortPayload {
  /** Bilingual cohort name — backend stores it on the translatable `name` column. */
  name: LocalizedText;
  start_date?: string | null;
  end_date?:   string | null;
  capacity?:   number | null;
  status?:     CohortStatus | null;
}

export interface CourseDetail {
  id: number;
  title: string;
  status: CourseStatus;
  type: CourseType;
  description?: string;
  category?: { id: number; name: string } | null;
  instructor?: { id: number; name: string };
  instructors?: Array<{ id: number; name: string }>;
  sections?: CourseSection[];
  enrolled_count?: number;
  cohorts_count?: number;
  completion_percent?: number;
  rating?: number;
  rating_count?: number;
  comments_count?: number;
  certificate?: boolean;
  certificate_pass_percent?: number;
  delivery_type?: string;
  created_at?: string;
  max_learners?: number;
  updated_at?: string;
  qualification_skills?: Array<{ id: number; name: string }>;
  qualifications?: Array<{ id: number; name: string }>;
  rating_distribution?: number[];
  reviews?: CourseReview[];
  cohorts?: Cohort[];
  learners?: CourseLearner[];
  /** Fully-qualified URL for the course thumbnail (or null). */
  image?: string | null;
}

export interface CourseLearner {
  id: number;
  name: string;
  cohort_name: string;
  progress: number;
  status: 'completed' | 'in_progress' | 'not_started';
  enrolled_at: string;
}

export interface CourseReview {
  id: number;
  user_name: string;
  user_machine_code?: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface CreateCoursePayload {
  title: LocalizedText;
  description: LocalizedText;
  course_type: ApiCourseType;
  category_id: number;
  hours: number;
  certificate: boolean;
  instructors: number[];
  qualification_skill_ids?: number[];
  active?: boolean;
  /** Per-course override for "Max per Cohort". Null/undefined → platform default. */
  max_learners?: number | null;
  image?: File;
}

/** Possible content types for a course module — drives form fields + chip label. */
export type ModuleContentType = 'video' | 'document' | 'article' | 'link';

/** Who can see the module: every cohort or one specific cohort/session. */
export type ModuleLearnerScope = 'all' | 'cohort';

/**
 * One module belonging to a course (backed by `course_lectures` rows).
 * `title` / `instructions` arrive as bilingual JSON so the edit dialog can
 * pre-fill both languages without a second request.
 */
export interface CourseModule {
  id: number;
  course_id: number;
  section_id: number;
  title: LocalizedText;
  instructions?: LocalizedText | null;
  content_type: ModuleContentType;
  learner_scope: ModuleLearnerScope;
  session_id?: number | null;
  duration_minutes?: number | null;
  type?: 'url' | 'file';
  video: string;
  require_completion: boolean;
  created_at?: string;
  updated_at?: string;
}

/* ── Cohort Attendance (drives the right-edge drawer on course detail) ───── */

/** One enrolled learner attached to a cohort session row (absent_learners). */
export interface CohortAttendanceLearnerRef {
  id: number;
  name: string;
}

/** A session row inside the cohort attendance rollup. */
export interface CohortAttendanceSession {
  id: number;
  /** 1-based chronological position — used as the fallback "Session N" label. */
  index: number;
  title: string;
  date: string | null;
  time_from: string | null;
  time_to: string | null;
  location: string | null;
  attended_count: number;
  absent_count: number;
  total: number;
  full_attendance: boolean;
  absent_learners: CohortAttendanceLearnerRef[];
}

/** One absent session reference attached to a learner row (absent_sessions). */
export interface CohortAttendanceSessionRef {
  id: number;
  index: number;
  title: string;
  date: string | null;
}

/** A learner row inside the cohort attendance rollup. */
export interface CohortAttendanceLearner {
  id: number;
  name: string;
  machine_code: string | null;
  department: string | null;
  total_sessions: number;
  attended_count: number;
  absent_count: number;
  absent_sessions: CohortAttendanceSessionRef[];
}

/**
 * Full payload returned by `GET /courses/{course}/cohorts/{cohort}/attendance`.
 * The shape is built once on the server so the drawer can render its two
 * tabs (Sessions / Learners) and three filter chips (All / Presence /
 * Absence) without any extra round-trips.
 */
export interface CohortAttendance {
  cohort:  { id: number; name: string; start_date: string | null; end_date: string | null };
  course:  { id: number; title: string };
  totals:  { sessions: number; learners: number; attended: number; absent: number };
  sessions: CohortAttendanceSession[];
  learners: CohortAttendanceLearner[];
}

/** Payload for creating or updating a module via the course-lectures endpoint. */
export interface ModulePayload {
  title: LocalizedText;
  instructions?: LocalizedText | null;
  content_type: ModuleContentType;
  learner_scope: ModuleLearnerScope;
  session_id?: number | null;
  duration_minutes?: number | null;
  type?: 'url' | 'file';
  video: string;
  require_completion: boolean;
}
