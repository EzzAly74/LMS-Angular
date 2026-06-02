/**
 * Single source of truth for every mobile API the sandbox exercises.
 *
 * The catalog drives the sidebar, the generic endpoint tester, the
 * journey runner and the generated API-COVERAGE.md. Endpoints map 1:1 to
 * `routes/apis/mobile.php` on the Laravel side.
 */

export type HttpMethod = 'GET' | 'POST';
export type ParamLocation = 'path' | 'query' | 'body';

export interface EndpointParam {
  name: string;
  in: ParamLocation;
  type: 'number' | 'string';
  required?: boolean;
  /** Pre-filled value used by the tester + journey runner. */
  default?: string | number;
  help?: string;
}

export interface EndpointDef {
  id: string;
  /** 1-based ordinal in the learner journey. */
  step: number;
  /** Human label for the journey step this endpoint belongs to. */
  journey: string;
  method: HttpMethod;
  label: string;
  /** Path template relative to the configured base url, e.g. `/mobile/academy/courses/{course}`. */
  path: string;
  params: EndpointParam[];
  /** Capabilities this endpoint is meant to demonstrate (rendered as chips). */
  features: string[];
  notes?: string;
  /** When true the journey "Run all" skips it (mutating / needs live state). */
  manualOnly?: boolean;
}

export const ENDPOINTS: EndpointDef[] = [
  {
    id: 'me',
    step: 1,
    journey: 'Login → Current User',
    method: 'GET',
    label: 'Get current learner (identity)',
    path: '/mobile/me',
    params: [],
    features: ['Authentication', 'Authorization', 'Locale'],
    notes: 'Verifies the shared bearer token + Employee-Code resolve to a learner.',
  },
  {
    id: 'academy_summary',
    step: 2,
    journey: 'Dashboard',
    method: 'GET',
    label: 'Academy entry summary (S-01)',
    path: '/mobile/academy/summary',
    params: [],
    features: ['Empty states', 'Locale'],
  },
  {
    id: 'academy_scopes',
    step: 3,
    journey: 'Courses List',
    method: 'GET',
    label: 'Scope chips · All / Special / General (S-02)',
    path: '/mobile/academy/scopes',
    params: [],
    features: ['Enum values', 'Locale', 'Empty states'],
    notes: 'Special = courses tied to the employee\'s job-title qualifications; General = for_public courses.',
  },
  {
    id: 'academy_courses',
    step: 4,
    journey: 'Courses List',
    method: 'GET',
    label: 'Available courses (S-02)',
    path: '/mobile/academy/courses',
    params: [
      { name: 'scope', in: 'query', type: 'string', help: 'all | special | general' },
      { name: 'category_id', in: 'query', type: 'number', help: 'Filter by category' },
      { name: 'search', in: 'query', type: 'string', help: 'Free-text search' },
      { name: 'per_page', in: 'query', type: 'number', default: 10, help: 'Page size' },
      { name: 'page', in: 'query', type: 'number', default: 1, help: 'Page number' },
    ],
    features: ['Pagination', 'Filtering', 'Sorting', 'Locale', 'Empty states'],
  },
  {
    id: 'academy_course_detail',
    step: 5,
    journey: 'Course Details',
    method: 'GET',
    label: 'Course detail + CTA state (S-03)',
    path: '/mobile/academy/courses/{course}',
    params: [
      { name: 'course', in: 'path', type: 'number', required: true, default: 6, help: 'Course id' },
    ],
    features: ['Locale', 'Error responses'],
  },
  {
    id: 'academy_enrol',
    step: 6,
    journey: 'Start Course (Enrol)',
    method: 'POST',
    label: 'Enrol into a cohort (S-03→S-04)',
    path: '/mobile/academy/courses/{course}/enrol',
    params: [
      { name: 'course', in: 'path', type: 'number', required: true, default: 6, help: 'Course id' },
      { name: 'cohort_id', in: 'body', type: 'number', help: 'Optional specific cohort' },
    ],
    features: ['Authorization', 'Error responses', 'Validation errors'],
    notes: 'Mutating — first-come-first-served capacity race. Returns 409 when full/closed.',
    manualOnly: true,
  },
  {
    id: 'my_overview',
    step: 7,
    journey: 'Profile · My Learning',
    method: 'GET',
    label: 'My Learning overview composite (S-05)',
    path: '/mobile/my-learning/overview',
    params: [],
    features: ['Empty states', 'Locale'],
  },
  {
    id: 'my_active',
    step: 8,
    journey: 'Profile · My Learning',
    method: 'GET',
    label: 'My active courses (S-05)',
    path: '/mobile/my-learning/active',
    params: [
      { name: 'page', in: 'query', type: 'number', default: 1, help: 'Page number' },
      { name: 'per_page', in: 'query', type: 'number', default: 10, help: 'Page size' },
    ],
    features: ['Pagination', 'Locale', 'Empty states'],
  },
  {
    id: 'my_qualifications',
    step: 9,
    journey: 'Profile · My Learning',
    method: 'GET',
    label: 'My qualifications progress (S-05)',
    path: '/mobile/my-learning/qualifications',
    params: [],
    features: ['Locale', 'Empty states'],
  },
  {
    id: 'my_sessions',
    step: 10,
    journey: 'View Attendance',
    method: 'GET',
    label: 'Course attendance log (S-05)',
    path: '/mobile/my-learning/courses/{course}/sessions',
    params: [
      { name: 'course', in: 'path', type: 'number', required: true, default: 6, help: 'Enrolled course id' },
    ],
    features: ['Authorization', 'Error responses', 'Locale'],
    notes: 'Returns 403 when the learner is not enrolled in the course.',
  },
  {
    id: 'attendance_mark',
    step: 11,
    journey: 'Mark Present (Passcode)',
    method: 'POST',
    label: 'Submit session passcode (S-06)',
    path: '/mobile/attendance/mark',
    params: [
      { name: 'course_id', in: 'body', type: 'number', required: true, default: 6, help: 'Course id' },
      { name: 'session_id', in: 'body', type: 'number', help: 'Optional explicit session' },
      { name: 'passcode', in: 'body', type: 'string', required: true, help: 'Code shown on the instructor dashboard' },
    ],
    features: ['Validation errors', 'Error responses', 'Authorization'],
    notes: 'Generate a live passcode on the instructor dashboard first. 422 = wrong/expired code, 409 = no open window/already marked.',
    manualOnly: true,
  },
  {
    id: 'my_rating',
    step: 12,
    journey: 'Ratings',
    method: 'POST',
    label: 'Submit / update cohort rating (S-05)',
    path: '/mobile/my-learning/courses/{course}/rating',
    params: [
      { name: 'course', in: 'path', type: 'number', required: true, default: 6, help: 'Course id' },
      { name: 'rating', in: 'body', type: 'number', required: true, default: 5, help: 'Settings-driven scale' },
      { name: 'comment', in: 'body', type: 'string', help: 'Required at/below a configured threshold' },
    ],
    features: ['Validation errors', 'Enum values'],
    manualOnly: true,
  },
  {
    id: 'my_certificates',
    step: 13,
    journey: 'Certificates',
    method: 'GET',
    label: 'Certificates list (S-07)',
    path: '/mobile/my-learning/certificates',
    params: [
      { name: 'page', in: 'query', type: 'number', default: 1, help: 'Page number' },
      { name: 'per_page', in: 'query', type: 'number', default: 10, help: 'Page size' },
    ],
    features: ['Pagination', 'Locale', 'Empty states'],
  },
  {
    id: 'certificate_detail',
    step: 14,
    journey: 'Certificates',
    method: 'GET',
    label: 'Single certificate detail (S-07)',
    path: '/mobile/certificates/{certificateId}',
    params: [
      { name: 'certificateId', in: 'path', type: 'number', required: true, default: 1, help: 'Certificate id (integer) taken from the certificates list' },
    ],
    features: ['Error responses', 'Locale'],
    notes: 'Use a numeric certificate id from the certificates list. 404 when not owned.',
    manualOnly: true,
  },
  {
    id: 'certificate_download',
    step: 15,
    journey: 'Certificates',
    method: 'GET',
    label: 'Download certificate image (S-07)',
    path: '/mobile/certificates/{certificateId}/download',
    params: [
      { name: 'certificateId', in: 'path', type: 'number', required: true, default: 1, help: 'Certificate id (integer)' },
    ],
    features: ['Download endpoints', 'Error responses'],
    notes: 'Returns a base64 JPEG payload (image_base64 + mime_type).',
    manualOnly: true,
  },
];

/** Endpoints the spec's journey lists but the mobile contract does NOT expose. */
export interface MissingEndpoint {
  journey: string;
  expected: string;
  reason: string;
}

export const MISSING_ENDPOINTS: MissingEndpoint[] = [
  {
    journey: 'Lessons / Complete Lesson',
    expected: 'GET /mobile/.../lessons, POST /mobile/.../lessons/{id}/complete',
    reason:
      'The mobile contract (S-01→S-07) is enrolment + attendance + certificates oriented. Lecture/lesson progress is web-only (admin/learner web under /api/v1/my, /courses/{id}/lectures). No mobile lesson endpoints exist.',
  },
  {
    journey: 'Quizzes / Submit Quiz',
    expected: 'GET /mobile/.../quizzes, POST /mobile/.../quizzes/{id}/submit',
    reason:
      'Quizzes/exams are exposed under the web API (/api/v1/quizzes, /exams) and are not part of the mobile S2S contract. Certificate derivation uses final-exam pass server-side, but there is no mobile quiz-taking endpoint.',
  },
  {
    journey: 'Notifications',
    expected: 'GET /mobile/notifications',
    reason:
      'Notifications exist for the admin SPA (/api/v1/notifications, role:Admin). There is no learner-facing mobile notifications endpoint in the current contract.',
  },
];

export const endpointById = (id: string): EndpointDef | undefined =>
  ENDPOINTS.find((e) => e.id === id);
