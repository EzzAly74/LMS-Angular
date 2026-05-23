/**
 * Domain types for the 2026 rich-question Admin Assignment workflow.
 *
 * These map 1:1 to the new Laravel resources in App\Http\Resources\Admin\.
 */

export type AssignmentStatus = 'draft' | 'active';
export type AssignmentCohortScope = 'all' | 'specific';
export type AssignmentQuestionType = 'mcq' | 'yes_no' | 'open' | 'reorder';
export type SubmissionStatus = 'graded' | 'pending';

export interface CourseLite {
  id: number;
  title: string;
}

export interface CohortLite {
  id: number;
  course_id?: number;
  title: string | null;
}

export interface AssignmentQuestion {
  id?: number;
  position?: number;
  type: AssignmentQuestionType;
  score: number;
  question_en: string;
  question_ar: string | null;
  options_en: string[];
  options_ar: string[];
  correct_answer_en: string | null;
  correct_answer_ar: string | null;
  explanation_en: string | null;
  explanation_ar: string | null;
}

/** List-view (paginated) shape — matches AdminAssignmentListResource. */
export interface AssignmentListItem {
  id: number;
  title: string;
  title_ar: string | null;
  course_id: number;
  course_title: string | null;
  cohort_scope: AssignmentCohortScope;
  cohorts: CohortLite[];
  questions_count: number;
  total_score: number;
  pass_score: number | null;
  status: AssignmentStatus;
  due_date: string | null;
  created_at: string | null;
}

/** Full assignment shape — matches AdminAssignmentResource. */
export interface Assignment {
  id: number;
  course_id: number;
  course: CourseLite | null;
  title: string;
  title_ar: string | null;
  instructions_en: string | null;
  instructions_ar: string | null;
  due_date: string | null;
  file_url: string | null;
  cohort_scope: AssignmentCohortScope;
  pass_score: number | null;
  total_score: number;
  status: AssignmentStatus;
  created_by: number | null;
  created_by_user: { id: number; name: string } | null;
  cohorts: CohortLite[];
  questions: AssignmentQuestion[];
  created_at: string | null;
  updated_at: string | null;
}

/** Minimal payload returned by /assignments/list — used in "View All" modal. */
export interface AssignmentOption {
  id: number;
  title: string;
  title_ar: string | null;
  course_id: number;
  course_title: string | null;
  status: AssignmentStatus;
}

export interface AssignmentSummary {
  assignments_count: number;
  courses_count: number;
}

/** Paginated submissions row — matches AdminAssignmentSubmissionResource. */
export interface SubmissionListItem {
  id: number;
  assignment: { id: number; title: string; course_id: number } | null;
  assignment_title: string | null;
  course_title: string | null;
  instructor_name: string | null;
  cohort_titles: string[];
  user: {
    id: number;
    name: string;
    machine_code: string | null;
    department_name: string | null;
  } | null;
  user_file_url: string | null;
  total_score: number | null;
  max_score: number;
  score_percent: number | null;
  feedback: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

/** Submission detail — matches AdminAssignmentSubmissionDetailResource. */
export interface SubmissionAnswer {
  id: number;
  awarded_score: number | null;
  is_correct: boolean | null;
  answer: AnswerPayload | null;
  feedback: string | null;
  question: AssignmentQuestion | null;
}

/** Discriminated answer payload sent by the learner. */
export type AnswerPayload =
  | { value: string }
  | { order: string[] };

export interface SubmissionDetail {
  id: number;
  assignment: {
    id: number;
    title: string;
    title_ar: string | null;
    status: AssignmentStatus;
    cohort_scope: AssignmentCohortScope;
    pass_score: number | null;
    total_score: number;
  } | null;
  course_title: string | null;
  instructor_name: string | null;
  user: {
    id: number;
    name: string;
    machine_code: string | null;
    department_name: string | null;
  } | null;
  user_file_url: string | null;
  total_score: number | null;
  max_score: number;
  score_percent: number | null;
  feedback: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  answers: SubmissionAnswer[];
}

/** Payload sent when creating / updating an assignment. */
export interface AssignmentSavePayload {
  course_id: number;
  title: string;
  title_ar: string | null;
  instructions_en: string | null;
  instructions_ar: string | null;
  due_date: string | null;
  cohort_scope: AssignmentCohortScope;
  cohort_ids: number[];
  pass_score: number | null;
  status: AssignmentStatus;
  questions: AssignmentQuestion[];
}

export interface InstructorOption {
  id: number;
  name: string;
}
