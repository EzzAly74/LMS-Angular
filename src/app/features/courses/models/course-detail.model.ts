/**
 * Course Details tab data (D2, Figma 2266:128868). Each shape matches the
 * backend resource named beside it.
 */

import type { Cohort } from '../../../core/models/course.types';

export type LearnerProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface IdName {
  id: number;
  name: string | null;
}

/** One enrolment - CourseLearnerResource (GET courses/{course}/enrollments). */
/** POST courses/{course}/sections/{section}/scheduled (Edit Cohort). */
export interface CohortScheduleUpdate {
  readonly section: Cohort;
  /** New sessions the sheet added. */
  readonly sessions_added: number;
  /** Upcoming sessions whose location the sheet changed. */
  readonly sessions_updated: number;
}

export interface CourseLearnerRow {
  id: number;
  user: { id: number; name: string; employee_id: string | null; active: boolean } | null;
  cohort: IdName | null;
  progress: number;
  status: LearnerProgressStatus;
  enrolled_at: string | null;
}

/**
 * One quiz or assignment submission row, the fields both admin submission
 * lists share (AdminQuizSubmissionResource / AdminAssignmentSubmissionResource).
 */
export interface CourseSubmissionRow {
  id: number;
  quiz_title?: string | null;
  assignment_title?: string | null;
  instructor_name: string | null;
  learner_cohort: IdName | null;
  user: { id: number; name: string } | null;
  score_percent: number | null;
  /** Against the item's own pass score (Q-031); null while ungraded or none set. */
  passed: boolean | null;
  attempts?: number;
  status: 'graded' | 'pending';
  submitted_at: string | null;
  created_at: string | null;
}

export interface StarBucket {
  value: number;
  count: number;
}

/** A template offered on the course's Evaluations tab. */
export interface CourseEvaluationTemplate {
  id: number;
  name: string | null;
  questions: number;
  submissions: number;
  /** True when the template runs on every evaluable course. */
  all_courses: boolean;
  cohort: IdName | null;
}

/** GET admin/courses/{course}/evaluation-summary. */
export interface CourseEvaluationSummary {
  course_id: number;
  reviews: number;
  with_comments: number;
  /** /5; null when nobody has evaluated the course. */
  average: number | null;
  scale_max: number;
  /** scale_max down to 1, gaps filled. */
  distribution: StarBucket[];
  learners_scored: number;
  learners_enrolled: number;
  templates: CourseEvaluationTemplate[];
}

/**
 * Learner progress bar tone, as drawn (Figma 2266:129915) and as the Learners
 * pages use it (D3): green at 100, slate from half, red below (D-060).
 */
export type ProgressBand = 'full' | 'mid' | 'low';

export function progressBand(percent: number): ProgressBand {
  return percent >= 100 ? 'full' : percent >= 50 ? 'mid' : 'low';
}
