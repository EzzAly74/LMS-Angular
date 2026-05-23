/**
 * Domain types for the 2026 rich-question Admin Quiz workflow.
 *
 * These map 1:1 to the new Laravel resources in App\Http\Resources\Admin\.
 */

export type QuizStatus = 'draft' | 'active';
export type QuizCohortScope = 'all' | 'specific';
export type QuizQuestionType = 'mcq' | 'yes_no' | 'open' | 'reorder';
export type QuizSubmissionStatus = 'graded' | 'pending';

export interface CourseLite {
  id: number;
  title: string;
}

export interface CohortLite {
  id: number;
  course_id?: number;
  title: string | null;
}

export interface QuizQuestion {
  id?: number;
  position?: number;
  type: QuizQuestionType;
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

/** List-view (paginated) shape — matches AdminQuizListResource. */
export interface QuizListItem {
  id: number;
  title: string;
  title_ar: string | null;
  course_id: number;
  course_title: string | null;
  cohort_scope: QuizCohortScope;
  cohorts: CohortLite[];
  questions_count: number;
  total_score: number;
  pass_score: number | null;
  status: QuizStatus;
  due_date: string | null;
  created_at: string | null;
}

/** Full quiz shape — matches AdminQuizResource. */
export interface Quiz {
  id: number;
  course_id: number;
  course: CourseLite | null;
  title: string;
  title_ar: string | null;
  instructions_en: string | null;
  instructions_ar: string | null;
  due_date: string | null;
  cohort_scope: QuizCohortScope;
  pass_score: number | null;
  total_score: number;
  status: QuizStatus;
  created_by: number | null;
  created_by_user: { id: number; name: string } | null;
  cohorts: CohortLite[];
  questions: QuizQuestion[];
  created_at: string | null;
  updated_at: string | null;
}

/** Minimal payload returned by /quizzes/list — used in the "View All" modal. */
export interface QuizOption {
  id: number;
  title: string;
  title_ar: string | null;
  course_id: number;
  course_title: string | null;
  status: QuizStatus;
}

export interface QuizSummary {
  quizzes_count: number;
  courses_count: number;
}

/** Paginated submissions row — matches AdminQuizSubmissionResource. */
export interface QuizSubmissionListItem {
  id: number;
  quiz: { id: number; title: string; course_id: number } | null;
  quiz_title: string | null;
  course_title: string | null;
  instructor_name: string | null;
  cohort_titles: string[];
  user: {
    id: number;
    name: string;
    machine_code: string | null;
    department_name: string | null;
  } | null;
  total_score: number | null;
  max_score: number;
  score_percent: number | null;
  attempts: number;
  status: QuizSubmissionStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

/** Submission detail — matches AdminQuizSubmissionDetailResource. */
export interface QuizSubmissionAnswer {
  id: number;
  awarded_score: number | null;
  is_correct: boolean | null;
  answer: QuizAnswerPayload | null;
  feedback: string | null;
  question: QuizQuestion | null;
}

/** Discriminated answer payload sent by the learner. */
export type QuizAnswerPayload =
  | { value: string }
  | { order: string[] };

export interface QuizSubmissionDetail {
  id: number;
  quiz: {
    id: number;
    title: string;
    title_ar: string | null;
    status: QuizStatus;
    cohort_scope: QuizCohortScope;
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
  total_score: number | null;
  max_score: number;
  score_percent: number | null;
  status: QuizSubmissionStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  answers: QuizSubmissionAnswer[];
}

/** Payload sent when creating / updating a quiz. */
export interface QuizSavePayload {
  course_id: number;
  title: string;
  title_ar: string | null;
  instructions_en: string | null;
  instructions_ar: string | null;
  due_date: string | null;
  cohort_scope: QuizCohortScope;
  cohort_ids: number[];
  pass_score: number | null;
  status: QuizStatus;
  questions: QuizQuestion[];
}

export interface QuizInstructorOption {
  id: number;
  name: string;
}
