/**
 * Admin evaluation reporting payloads (B3 + D4 backend, D-054).
 *
 * A template is a legacy `evaluation_categories` row; its questions are
 * `evaluations`. A submission has no id - it is the answers sharing
 * (learner, course, template), so every link carries all three.
 *
 * `score` is on a /`score_max` (5) scale and `passed` is its verdict against
 * the pass threshold, both decided by the API so the list, the filter and the
 * detail cannot disagree. `null` score means unscored, never zero.
 */

export const EVALUATION_RESULTS = ['passed', 'failed', 'unscored'] as const;
export type EvaluationResult = (typeof EVALUATION_RESULTS)[number];

/** Stored `evaluations.type`: five = star rating, ten = 1..10 scale, text = written. */
export type QuestionType = 'five' | 'ten' | 'text';

export interface EvaluationTemplateRow {
  id: number;
  name: string | null;
  questions: number;
  submissions: number;
  learners_scored: number;
  learners_eligible: number;
  score: number | null;
  passed: boolean | null;
  last_scored_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DistributionBucket {
  value: number;
  count: number;
}

export interface TemplateQuestion {
  id: number;
  title: string | null;
  type: QuestionType;
  required: boolean;
  scale_max: number | null;
  responses: number;
  average: number | null;
  /** scale_max down to 1, gaps filled; null for written questions. */
  distribution: DistributionBucket[] | null;
}

export interface TemplateResults {
  template: { id: number; name: string | null; questions: number; created_at: string | null };
  summary: {
    score: number | null;
    score_max: number;
    pass_threshold: number;
    passed: boolean | null;
    learners_scored: number;
    learners_eligible: number;
    submissions: number;
    last_scored_at: string | null;
  };
  questions: TemplateQuestion[];
}

export interface EvaluationLearnerRef {
  id: number;
  name: string | null;
  employee_id: string | null;
  department: string | null;
}

export interface EvaluationScoreRow {
  learner: EvaluationLearnerRef;
  course: { id: number; name: string | null };
  template: { id: number | null; name: string | null; created_at: string | null };
  answers_count: number;
  total: number;
  max_total: number;
  ratio: number | null;
  score: number | null;
  passed: boolean | null;
  submitted_at: string | null;
}

export interface SubmissionAnswer {
  evaluation_id: number;
  title: string | null;
  type: QuestionType;
  scale_max: number | null;
  answer: string | null;
  is_text: boolean;
}

export interface EvaluationSubmission {
  learner: EvaluationLearnerRef;
  course: { id: number; name: string | null };
  template: { id: number | null; name: string | null; created_at: string | null };
  instructor: { id: number | null; name: string | null };
  submitted_at: string | null;
  total: number;
  max_total: number;
  ratio: number | null;
  score: number | null;
  score_max: number;
  pass_threshold: number;
  passed: boolean | null;
  answers: SubmissionAnswer[];
}

export interface EvaluationFilterOptions {
  instructors: { id: number; name: string | null }[];
  courses: { id: number; name: string | null }[];
}

export interface EvaluationLearnerOption {
  id: number;
  name: string | null;
  employee_id: string | null;
}

/** "4.3" - one decimal, as the API rounds. */
export function formatScore(score: number): string {
  return score.toFixed(1);
}
