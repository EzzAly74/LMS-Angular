/**
 * One row of GET admin/users?role=learner (AdminUserListResource). Only the
 * fields the Learners list (Figma 1986:74701) reads.
 */
export interface LearnerRow {
  id: number;
  source: 'user' | 'instructor' | 'admin';
  composite_id: string;
  name: string;
  machine_code: string | null;
  image: string | null;
  avatar_initial: string;
  job_title: string | null;
  courses_earned: number;
  /** 0-100, or null when the learner has no job-title qualifications to measure. */
  compliance_pct: number | null;
  last_certification_at: string | null;
  /** ISO-8601. */
  last_active_at: string | null;
}

/** The learner types the backend accepts (AdminUserIndexRequest::LEARNER_TYPES). */
export const LEARNER_TYPES = ['online', 'offline', 'hybrid'] as const;
export type LearnerType = (typeof LEARNER_TYPES)[number];

/** Every filter the page can apply; each list matches ANY of its values. */
export interface LearnerFilters {
  course_instructor_ids: number[];
  learner_types: LearnerType[];
  course_ids: number[];
  qualification_ids: number[];
}

export type LearnerFilterKey = keyof LearnerFilters;

// ── Learner detail (Figma 2181:115043; GET admin/learners/{id}[/courses|/performance]) ──

export interface LearnerProfile {
  profile: {
    id: number;
    name: string;
    job_title: string | null;
    employee_id: string | null;
    email: string | null;
    department: string | null;
    image_url: string | null;
    status: string;
    last_active_at: string | null;
    last_active_course: string | null;
  };
  tiles: {
    completed_courses: number;
    active_courses: number;
    /** Null when there is no active course to measure. */
    active_course_progress_percent: number | null;
    last_quiz: { score: number | null; max: number; status: string | null; submitted_at: string | null } | null;
    earned_qualifications: number;
  };
}

export interface LearnerCourseRow {
  course_id: number;
  course: string | null;
  cohort: string | null;
  cohort_id: number | null;
  qualifications: { id: number; name: string | null }[];
  attended: number;
  absent: number;
  sessions_scheduled: number;
  status: 'completed' | 'active';
  /** Attendance-based; null when the cohort has no scheduled sessions. */
  progress_percent: number | null;
  started_on: string | null;
  ended_on: string | null;
  enrolled_at: string | null;
}

export interface LearnerPerformanceRow {
  id: number;
  kind: 'quiz' | 'assignment';
  name: string | null;
  course: string | null;
  /** pre | mid | post for quizzes, assignment for assignments. */
  type: string | null;
  score: number | null;
  max_score: number | null;
  grade_label: string | null;
  status: 'pass' | 'failed' | 'needs_review';
  last_updated: string | null;
}
