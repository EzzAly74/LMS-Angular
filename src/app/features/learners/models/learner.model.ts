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
