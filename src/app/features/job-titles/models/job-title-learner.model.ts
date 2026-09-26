/**
 * One row of GET admin/job-titles/{id}/learners (JobTitleLearnerResource,
 * backend B1). Mirrors the resource field for field; nothing is derived here.
 */
export interface JobTitleLearner {
  id: number;
  name: string;
  /** The employee number the Figma table labels "ID" (users.machine_code). */
  employee_id: string | null;
  image_url: string | null;
  department: string | null;
  courses: { completed: number; total: number; label: string };
  qualifications_completed: number;
  qualifications_total: number;
  qualification_breakdown: QualificationProgress[];
  /** Whole percent 0-100 across the learner's relevant courses. */
  completion_percent: number;
}

/** One sub-row: a qualification the job title requires, for one learner. */
export interface QualificationProgress {
  id: number;
  name: string;
  courses_total: number;
  courses_completed: number;
  /** 0-100. 100 when granted directly (D-045). */
  percent: number;
  /** Granted by an admin rather than earned by completing courses. */
  granted_directly: boolean;
  earned: boolean;
}

/** GET job-titles/{id}: only the fields this page reads. */
export interface JobTitleSummary {
  id: number;
  name: string;
}
