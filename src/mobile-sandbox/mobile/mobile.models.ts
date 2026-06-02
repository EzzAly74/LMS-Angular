/**
 * Loose view-model interfaces mirroring the Laravel Mobile resources.
 * Fields are optional/defensive on purpose — the sandbox renders live
 * data and must degrade gracefully while the backend evolves.
 *
 * Source resources (Lms-Backend/app/Http/Resources/Mobile):
 *   AcademyCourseCardResource, AcademyCourseDetailResource,
 *   MyLearningOverviewResource, MyLearningActiveCourseResource,
 *   QualificationProgressResource, MyLearningSessionResource,
 *   CertificateResource.
 */

export interface NamedRef {
  id: number;
  name: string;
  image?: string | null;
}

export interface CourseRating {
  avg: number;
  count: number;
  sentiment: string;
}

export interface NextCohort {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  capacity: number | null;
  enrolled_count: number;
  seats_left: number | null;
  enrolment_closes_at?: string | null;
  days_until_deadline?: number | null;
  days_until_start?: number | null;
  deadline_severity?: 'none' | 'low' | 'medium' | 'high' | string;
}

export interface CourseCard {
  id: number;
  title: string;
  description?: string | null;
  course_type?: string | null;
  image?: string | null;
  hours?: number;
  has_certificate?: boolean;
  category?: NamedRef | null;
  instructors?: NamedRef[];
  qualifications?: NamedRef[];
  rating?: CourseRating;
  next_cohort?: NextCohort | null;
}

export interface CourseUnit {
  id: number;
  title: string;
  type?: string | null;
  duration_minutes?: number | null;
  order?: number | null;
}

export interface CohortBlock {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  capacity?: number | null;
  enrolled_count?: number;
  seats_left?: number | null;
}

export interface CourseCta {
  state: string;
  label_key: string;
  enabled: boolean;
}

export interface CourseDetail extends CourseCard {
  allow_attendance?: boolean;
  enrolled_users_count?: number;
  units?: CourseUnit[];
  cohorts?: CohortBlock[];
  anchor_cohort?: CohortBlock | null;
  cta?: CourseCta;
}

export interface LearnerIdentity {
  machine_code?: string | null;
  name?: string | null;
  department?: string | null;
  job_title?: string | null;
  email?: string | null;
}

export interface ActiveCourseProgress {
  percent: number;
  completed_lectures: number;
  total_lectures: number;
  attended_sessions: number;
  past_sessions: number;
  total_sessions: number;
  absences: number;
  next_unit_title?: string | null;
}

export interface ActiveLiveSession {
  id: number;
  title?: string | null;
  session_date?: string | null;
  time_from?: string | null;
  time_to?: string | null;
  location?: string | null;
}

export interface ActiveCourse {
  id: number;
  title: string;
  course_type?: string | null;
  image?: string | null;
  category?: NamedRef | null;
  cohort?: { id: number; name: string; start_date?: string | null; end_date?: string | null } | null;
  progress?: ActiveCourseProgress;
  live_session?: ActiveLiveSession | null;
  /** Derived client-side: average rating the learner already gave. */
  user_rating?: number | null;
}

export interface QualificationProgress {
  id: number;
  name: string;
  total_courses: number;
  completed_courses: number;
  percent: number;
}

export interface CertificateCard {
  /** First-class certificate primary key (integer). Replaces the old `exam:1` compound id. */
  id: number;
  uuid?: string;
  certificate_number?: string;
  status?: string;
  course?: { id: number; title: string } | null;
  course_id: number;
  course_title: string;
  issued_at?: string | null;
  issued_date?: string | null;
  user_rating?: number | null;
}

/** Payload of `GET /mobile/certificates/{certificateId}/download`. */
export interface CertificateImage {
  id: number;
  certificate_number?: string;
  course_id: number;
  course_title: string;
  issued_at?: string | null;
  image_base64: string;
  mime_type: string;
}

export interface MyLearningOverview {
  learner?: LearnerIdentity | null;
  counts: { active_courses: number; qualifications: number; certificates: number };
  previews: {
    active_courses: ActiveCourse[];
    qualifications: QualificationProgress[];
    certificates: CertificateCard[];
  };
}

export interface AttendanceSession {
  id: number;
  title?: string | null;
  session_date?: string | null;
  time_from?: string | null;
  time_to?: string | null;
  attended: boolean;
}

/** S-02 fixed scope chip: All / Special / General. */
export interface ScopeChip {
  key: 'all' | 'special' | 'general';
  label: string;
  count: number;
  is_all: boolean;
}
