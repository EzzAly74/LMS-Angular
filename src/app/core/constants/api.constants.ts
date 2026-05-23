import { environment } from '../../../environments/environment';

export const API_BASE = `${environment.apiBaseUrl}/api/v1`;

export const API = {
  AUTH: {
    LOGIN:   `${API_BASE}/auth/admin/login`,
    LOGOUT:  `${API_BASE}/auth/admin/logout`,
    ME:      `${API_BASE}/auth/admin/me`,
    PROFILE: `${API_BASE}/auth/admin/profile`,
  },
  USERS:          `${API_BASE}/users`,
  ADMIN_USERS:    `${API_BASE}/admin/users`,
  ADMINS:              `${API_BASE}/admins`,
  ADMIN_CONTROLLERS:   `${API_BASE}/admin/controllers`,
  DASHBOARD:      `${API_BASE}/dashboard`,
  JOB_TITLES:     `${API_BASE}/job-titles`,
  QUALIFICATIONS: `${API_BASE}/qualification-skills`,
  RATINGS:        `${API_BASE}/ratings`,
  ADMIN_RATINGS:  `${API_BASE}/admin/ratings`,
  MESSAGES:       `${API_BASE}/messages`,
  LMS_RESOURCES:  `${API_BASE}/lms-resources`,
  COURSES:        `${API_BASE}/courses`,
  CATEGORIES:        `${API_BASE}/categories`,
  CATEGORIES_ACTIVE: `${API_BASE}/categories/active`,
  INSTRUCTORS:       `${API_BASE}/instructors`,
  INSTRUCTORS_ALL:   `${API_BASE}/instructors/all`,
  QUALIFICATIONS_ACTIVE: `${API_BASE}/qualification-skills/active`,
  ARTICLES:       `${API_BASE}/articles`,
  FORMS:          `${API_BASE}/forms`,
  ROLES:          `${API_BASE}/roles`,
  ADMIN_ROLES:    `${API_BASE}/admin/roles`,
  PERMISSIONS:    `${API_BASE}/permissions`,
  NOTIFICATIONS:  `${API_BASE}/notifications`,
  SETTINGS:       `${API_BASE}/settings`,
  ADMIN_SETTINGS: `${API_BASE}/admin/settings`,
  CERTIFICATES:   `${API_BASE}/certificates`,
  EVALUATIONS:    `${API_BASE}/evaluations`,
  ASSIGNMENTS:    `${API_BASE}/assignments`,
  ADMIN_ASSIGNMENTS: `${API_BASE}/admin/assignments`,
  QUIZZES:        `${API_BASE}/quizzes`,
  ADMIN_QUIZZES:  `${API_BASE}/admin/quizzes`,
  AUDIT_LOG:        `${API_BASE}/audit-log`,
  ADMIN_AUDIT_LOG:  `${API_BASE}/admin/audit-log`,
  REPORTS:        `${API_BASE}/reports`,
  ADMIN_REPORTS:  `${API_BASE}/admin/reports`,
  ATTENDANCE:     `${API_BASE}/attendance`,
  EXAMS:          `${API_BASE}/exams`,
} as const;

/** Course-scoped nested routes */
export const courseUrl = {
  detail:      (id: number) => `${API.COURSES}/${id}`,
  exams:       (id: number) => `${API.COURSES}/${id}/exams`,
  exam:        (courseId: number, examId: number) => `${API.COURSES}/${courseId}/exams/${examId}`,
  assignments: (id: number) => `${API.COURSES}/${id}/assignments`,
  assignment:  (courseId: number, assignmentId: number) =>
    `${API.COURSES}/${courseId}/assignments/${assignmentId}`,
  sessions:    (id: number) => `${API.COURSES}/${id}/sessions`,
  session:     (courseId: number, sessionId: number) =>
    `${API.COURSES}/${courseId}/sessions/${sessionId}`,
  enrollments: (id: number) => `${API.COURSES}/${id}/enrollments`,
  modules:     (id: number) => `${API.COURSES}/${id}/modules`,
  lectures:    (id: number) => `${API.COURSES}/${id}/lectures`,
  lecture:     (courseId: number, lectureId: number) =>
    `${API.COURSES}/${courseId}/lectures/${lectureId}`,
} as const;
