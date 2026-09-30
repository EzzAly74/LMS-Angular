import { Observable } from 'rxjs';
import type { ApiParams } from '../../core/services/api.service';
import type { PaginatedResponse } from '../../core/models/api-response.model';

/** Pre / Mid / Post (Figma 1981:41345), the same for quizzes and assignments. */
export type AssessmentType = 'pre' | 'mid' | 'post';

/** A created quiz or assignment, as the "created" table shows it. */
export interface AssessmentItemRow {
  readonly id: number;
  readonly title: string;
  readonly course_title: string | null;
  readonly cohort_scope: string;
  readonly cohorts: readonly { readonly title: string | null }[];
  readonly questions_count: number;
  readonly total_score: number;
  readonly due_date: string | null;
}

/** One attempt, as the attempts table shows it (quiz_* / assignment_* fields normalised). */
export interface AssessmentAttemptRow {
  readonly id: number;
  readonly user: { readonly id: number; readonly name: string } | null;
  readonly course_title: string | null;
  readonly instructor_name: string | null;
  readonly item_title: string | null;
  readonly item_type: AssessmentType | null;
  readonly status: string;
  readonly score_percent: number | null;
  readonly passed: boolean | null;
  readonly submitted_at: string | null;
  readonly created_at: string | null;
}

export interface AssessmentOptionRow {
  readonly id: number;
  readonly title: string;
  readonly course_title: string | null;
}

export interface IdName {
  readonly id: number;
  readonly name: string | null;
}

/**
 * What the shared Quizzes / Assignments list needs from one kind: its API and
 * the translation keys that differ by kind. The rest of the keys are
 * `${ns}.<key>` with the same key for both kinds.
 */
export interface AssessmentListSource {
  readonly kind: 'quiz' | 'assignment';
  /** Translation namespace: `quizzes` / `assignments`. */
  readonly ns: string;
  /** Toast namespace: `quizzes_list_toasts` / `assignments_list_toasts`. */
  readonly toastNs: string;
  /** Keys whose names differ by kind. */
  readonly keys: {
    readonly subtitle: string;
    readonly allCreated: string;
    readonly colItems: string;
    readonly colItem: string;
    readonly viewItem: string;
  };
  /** `/admin/quizzes` / `/admin/assignments`. */
  readonly route: string;
  readonly types: readonly AssessmentType[];

  summary(): Observable<{ readonly items: number; readonly courses: number }>;
  items(params: ApiParams): Observable<PaginatedResponse<AssessmentItemRow>>;
  options(search?: string): Observable<readonly AssessmentOptionRow[]>;
  remove(id: number): Observable<unknown>;
  attempts(params: ApiParams): Observable<PaginatedResponse<AssessmentAttemptRow>>;
  /** Learners and instructors that have attempts, across all courses (bounded server-side). */
  filterOptions(): Observable<{ readonly learners: readonly IdName[]; readonly instructors: readonly IdName[] }>;
}
