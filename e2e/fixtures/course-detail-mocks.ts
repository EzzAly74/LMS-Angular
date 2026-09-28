import { Page, Request } from '@playwright/test';

/**
 * Mocked API for Course Details (course 10) in the real response shapes:
 * CourseDetailResource, CourseSectionResource, CourseLearnerResource, the
 * admin submission resources, the evaluation summary / template results.
 * Shared by the D2 specs; a spec file must not import another spec, or that
 * file's tests are registered (and run) twice.
 */
export const ok = (result: unknown) => ({ status: 'success', message: '', result });
const page1 = (rows: unknown[], total = rows.length, perPage = 10) =>
  ({ ...ok(rows), meta: { current_page: 1, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total } });

export const COURSE = {
  id: 10,
  title: { en: 'Workplace Safety Essentials', ar: 'أساسيات السلامة في العمل' },
  description: { en: '<p>A blended course on workplace safety.</p>', ar: '<p>دورة مدمجة عن السلامة.</p>' },
  what_students_will_learn: { en: ['Identify hazards'], ar: ['تحديد المخاطر'] },
  requirements: { en: ['One year of supervision'], ar: ['سنة من الإشراف'] },
  course_type: 'hybrid', type: 'hybrid', status: 'active', active: true, level: 'intermediate',
  category: { id: 1, name: 'Safety' }, instructors: [{ id: 3, name: 'Nora Al-Fahad' }],
  qualification_skills: [{ id: 1, name: 'Workplace Safety Certified' }, { id: 2, name: 'ISO 45001 Awareness' }],
  certificate: true, certificate_pass_percent: 75, max_learners: 30, number_of_sessions: 12,
  created_at: '2025-08-01', updated_at: '2026-05-10', image: null,
  enrolled_count: 12, in_progress_count: 5, cohorts_count: 2, completion_percent: 71,
  evaluation_score: 4.3, evaluation_submissions: 58,
  modules_count: 0, quiz_submissions_count: 3, assignment_submissions_count: 0,
};

export const COHORTS = [
  { id: 21, name: 'Cohort A', name_translations: { en: 'Cohort A', ar: 'الدفعة أ' }, start_date: '2025-06-01', end_date: '2025-07-31',
    capacity: 30, status: 'completed', number_of_sessions: 12, enrolled_count: 8 },
  { id: 22, name: 'Cohort B', name_translations: { en: 'Cohort B', ar: 'الدفعة ب' }, start_date: '2026-03-15', end_date: '2026-04-30',
    capacity: 30, status: 'active', number_of_sessions: 4, enrolled_count: 22 },
];

const LEARNERS = [
  { id: 1, user: { id: 101, name: 'Ali Al-Kaabi', employee_id: 'E1', active: true }, cohort: { id: 22, name: 'Cohort B' }, progress: 100, status: 'completed', enrolled_at: '2026-03-15T00:00:00Z' },
  { id: 2, user: { id: 102, name: 'Tariq Al-Saud', employee_id: 'E2', active: false }, cohort: { id: 22, name: 'Cohort B' }, progress: 30, status: 'in_progress', enrolled_at: '2026-03-20T00:00:00Z' },
];

const QUIZ_ROWS = [
  { id: 501, quiz_title: 'Knowledge Check Quiz', instructor_name: 'Nora Al-Fahad', learner_cohort: { id: 21, name: 'Cohort A' },
    user: { id: 101, name: 'Fatima Al-Rashidi' }, score_percent: 80, passed: true, attempts: 1, status: 'graded', submitted_at: '2026-05-14 10:00:00', created_at: null },
  { id: 502, quiz_title: 'GDPR Knowledge Check', instructor_name: 'Ahmed Al-Rashidi', learner_cohort: { id: 22, name: 'Cohort B' },
    user: { id: 102, name: 'Fatima Al-Rashid' }, score_percent: 62, passed: false, attempts: 2, status: 'graded', submitted_at: '2026-05-07 10:00:00', created_at: null },
];

const ASSIGNMENT_ROWS = [
  { id: 601, assignment_title: 'Practical Assessment', instructor_name: 'Nora Al-Fahad', learner_cohort: { id: 22, name: 'Cohort B' },
    user: { id: 103, name: 'Layla Hassan' }, score_percent: 88, passed: true, status: 'graded', submitted_at: '2026-05-16 10:00:00', created_at: null },
  { id: 602, assignment_title: 'Practical Assessment', instructor_name: 'Nora Al-Fahad', learner_cohort: { id: 22, name: 'Cohort B' },
    user: { id: 104, name: 'Fatima Al-Rashidi' }, score_percent: null, passed: null, status: 'pending', submitted_at: '2026-05-14 10:00:00', created_at: null },
];

const SUMMARY = {
  course_id: 10, reviews: 58, with_comments: 3, average: 4.3, scale_max: 5,
  distribution: [{ value: 5, count: 24 }, { value: 4, count: 18 }, { value: 3, count: 10 }, { value: 2, count: 4 }, { value: 1, count: 2 }],
  learners_scored: 58, learners_enrolled: 60,
  templates: [
    { id: 5, name: 'Course Feedback', questions: 1, submissions: 58, all_courses: true, cohort: null },
    { id: 6, name: 'Instructor Feedback', questions: 1, submissions: 4, all_courses: false, cohort: null },
  ],
};

const results = (id: number, name: string) => ({
  template: { id, name, questions: 1, created_at: null, course: null, cohort: null, locked: true },
  summary: { score: 4.3, score_max: 5, pass_threshold: 3, passed: true, learners_scored: 58, learners_eligible: 60, submissions: 58, last_scored_at: null },
  questions: [{ id: 9, title: `${name}: overall`, type: 'five', required: true, scale_max: 5, scale_label_min: null, scale_label_max: null,
    responses: 58, average: 4.3, distribution: [{ value: 5, count: 24 }, { value: 4, count: 18 }, { value: 3, count: 10 }, { value: 2, count: 4 }, { value: 1, count: 2 }] }],
});

export async function mockCourse(page: Page, overrides: Record<string, unknown> = {}): Promise<Request[]> {
  const seen: Request[] = [];
  page.on('request', r => { if (r.url().includes('/api/v1/')) seen.push(r); });
  await page.route(/\/api\/v1\/courses\/10(\?.*)?$/, r => r.fulfill({ json: ok({ ...COURSE, ...overrides }) }));
  await page.route(/\/api\/v1\/courses\/10\/sections(\?.*)?$/, r => r.fulfill({ json: ok(COHORTS) }));
  await page.route('**/api/v1/courses/10/modules**', r => r.fulfill({ json: ok([]) }));
  await page.route('**/api/v1/courses/10/enrollments**', r => {
    const u = new URL(r.request().url());
    const g = u.searchParams.get('group_id');
    const s = u.searchParams.get('search');
    const rows = LEARNERS.filter(l => (!g || String(l.cohort.id) === g) && (!s || l.user.name.toLowerCase().includes(s.toLowerCase())));
    return r.fulfill({ json: page1(rows) });
  });
  await page.route('**/api/v1/admin/quizzes/submissions/filter-options**', r => r.fulfill({ json: ok({
    learners: [{ id: 101, name: 'Fatima Al-Rashidi' }], instructors: [{ id: 3, name: 'Nora Al-Fahad' }], items: [{ id: 7, name: 'Knowledge Check Quiz' }] }) }));
  await page.route(/\/api\/v1\/admin\/quizzes\/submissions\?/, r => r.fulfill({ json: page1(QUIZ_ROWS) }));
  await page.route('**/api/v1/admin/assignments/submissions/filter-options**', r => r.fulfill({ json: ok({ learners: [], instructors: [], items: [] }) }));
  await page.route(/\/api\/v1\/admin\/assignments\/submissions\?/, r => r.fulfill({ json: page1(ASSIGNMENT_ROWS) }));
  await page.route('**/api/v1/admin/courses/10/evaluation-summary', r => r.fulfill({ json: ok(SUMMARY) }));
  await page.route(/\/api\/v1\/admin\/evaluations\/(\d+)\/results\?/, r => {
    const id = Number(/evaluations\/(\d+)\//.exec(r.request().url())![1]);
    return r.fulfill({ json: ok(results(id, id === 5 ? 'Course Feedback' : 'Instructor Feedback')) });
  });
  return seen;
}
