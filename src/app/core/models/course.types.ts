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

export interface Cohort {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  enrolled: number;
  capacity: number;
  status: 'completed' | 'active' | 'upcoming' | 'inactive';
  section_id?: number;
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
