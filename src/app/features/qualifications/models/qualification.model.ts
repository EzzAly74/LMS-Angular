/**
 * Qualifications page (D5) - the shapes of admin/qualification-skills.
 * What each figure counts is decided on the server (D-056).
 */

export interface QualificationRow {
  id: number;
  name: string;
  courses_count: number;
  /** Learners enrolled in any linked course. */
  enrolled_count: number;
  job_titles_count: number;
  /** People it applies to: their job title requires it, or it was granted to them. */
  learners_count: number;
  /** How many of them hold it. */
  certified_count: number;
  /** Their average progress; null when nobody needs it. */
  completion_percent: number | null;
  created_at: string | null;
}

export interface LocalizedPair {
  en: string;
  ar: string;
}

export interface JobTitleOption {
  id: number;
  name: string;
  employees: number;
}

export interface LearnerOption {
  id: number;
  name: string;
  employee_id: string | null;
}

export interface QualificationDetail {
  id: number;
  name: LocalizedPair;
  job_titles: JobTitleOption[];
  learners: LearnerOption[];
  learners_total: number;
  /** False when more learners hold it directly than the modal can list. */
  learners_editable: boolean;
}

export interface QualificationPayload {
  name: LocalizedPair;
  job_title_ids: number[];
  learner_ids?: number[];
}

export interface Assignees {
  job_titles: JobTitleOption[];
  learners: LearnerOption[];
}

export type AssigneeType = 'all' | 'job_titles' | 'learners';

export interface QualificationImportError {
  row: number;
  column: string | null;
  message: string;
}

export interface QualificationImportReport {
  created: number;
  errors: QualificationImportError[];
}

/** Server limits, mirrored for UX only (AdminQualificationRequest). */
export const NAME_MAX = 255;
