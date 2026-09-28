import { expect, Page, Request, test } from '@playwright/test';
import { mockCourse } from './fixtures/course-detail-mocks';

/**
 * D2 - Course Details tabs (Figma 2266:128868), against a mocked API in the
 * real response shapes (CourseDetailResource, CourseSectionResource,
 * CourseLearnerResource, the admin submission resources, the evaluation
 * summary / template results). Behaviour only: desktop project.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

async function open(page: Page, tab?: string): Promise<Request[]> {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  const seen = await mockCourse(page);
  await page.goto(`/admin/courses/10${tab ? `?tab=${tab}` : ''}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Workplace Safety Essentials' })).toBeVisible();
  return seen;
}

const tabs = (page: Page) => page.getByRole('tablist');

test('header: tiles, "N Active", counts hidden at zero, evaluations score as its count', async ({ page }) => {
  await open(page);
  await expect(page.getByText('5 Active')).toBeVisible();
  await expect(page.getByText('Evaluation (58 reviews)')).toBeVisible();
  // Content has no modules and Assignments no submissions: no number (Figma note).
  await expect(tabs(page).getByRole('tab', { name: 'Content' })).toHaveText('Content');
  await expect(tabs(page).getByRole('tab', { name: 'Assignments' })).toHaveText('Assignments');
  await expect(tabs(page).getByRole('tab', { name: /Quizzes/ })).toContainText('3');
  await expect(tabs(page).getByRole('tab', { name: /Evaluations/ })).toContainText('4.3');
  // No delete control next to Edit (Figma note).
  await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
});

test('tabs: ?tab= opens a tab, arrow keys move, the URL follows', async ({ page }) => {
  await open(page, 'learners');
  const learnersTab = tabs(page).getByRole('tab', { name: /Learners/ });
  await expect(learnersTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'cd-tab-learners');
  await learnersTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs(page).getByRole('tab', { name: 'Content' })).toHaveAttribute('aria-selected', 'true');
  await expect(tabs(page).getByRole('tab', { name: 'Content' })).toBeFocused();
  await expect(page).toHaveURL(/tab=content/);
});

test('overview: settings card and learner evaluations histogram', async ({ page }) => {
  await open(page);
  await expect(page.getByText('Yes — min 75%')).toBeVisible();
  await expect(page.getByText('30 learners')).toBeVisible();
  await expect(page.getByText('out of 5 · 58 reviews')).toBeVisible();
  await expect(page.locator('.ov-eval__row')).toHaveCount(5);
});

test('learners: rows, account dot, server search and filter, eye to the profile', async ({ page }) => {
  const seen = await open(page, 'learners');
  await expect(page.getByRole('row', { name: /Ali Al-Kaabi/ })).toContainText('Completed');
  await expect(page.getByRole('row', { name: /Tariq Al-Saud/ })).toContainText('inactive account');
  await expect(page.getByRole('link', { name: "View Ali Al-Kaabi's profile" })).toHaveAttribute('href', '/admin/learners/101');

  await page.getByRole('searchbox').fill('tariq');
  await expect(page.getByRole('row', { name: /Ali Al-Kaabi/ })).toHaveCount(0);
  expect(seen.some(r => r.url().includes('/enrollments') && r.url().includes('search=tariq'))).toBe(true);

  await page.getByRole('button', { name: 'Filter' }).click();
  const d = page.getByRole('dialog', { name: 'Filter' });
  await expect(d.getByRole('button', { name: 'Filter' })).toBeDisabled();
  await d.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'In Progress' }).click();
  await d.getByRole('button', { name: 'Filter' }).click();
  await expect(d).toBeHidden();
  expect(seen.some(r => r.url().includes('/enrollments') && r.url().includes('status=in_progress'))).toBe(true);
  await expect(page.getByRole('button', { name: /Filter/ }).first()).toContainText('1');
});

test('quizzes: learner cohort, pass / fail colour, filter by quiz, eye to the submission', async ({ page }) => {
  const seen = await open(page, 'quizzes');
  const passRow = page.getByRole('row', { name: /Fatima Al-Rashidi/ });
  await expect(passRow).toContainText('Cohort A');
  await expect(passRow.locator('.cl-pass')).toHaveText('80%');
  await expect(page.getByRole('row', { name: /Fatima Al-Rashid\b/ }).locator('.cl-fail')).toHaveText('62%');
  await expect(page.getByRole('link', { name: /View Fatima Al-Rashidi's submission/ })).toHaveAttribute('href', '/admin/quizzes/submissions/501');
  expect(seen.some(r => r.url().includes('/admin/quizzes/submissions?') && r.url().includes('course_id=10'))).toBe(true);

  await page.getByRole('button', { name: 'Filter' }).click();
  const d = page.getByRole('dialog', { name: 'Filter' });
  // Figma note: Learner, Cohort, Instructor, Quiz.
  for (const label of ['Learner', 'Cohort', 'Instructor', 'Quiz']) await expect(d.getByRole('combobox', { name: label })).toBeVisible();
  await d.getByRole('combobox', { name: 'Quiz' }).click();
  await page.getByRole('option', { name: 'Knowledge Check Quiz' }).click();
  await d.getByRole('combobox', { name: 'Cohort' }).click();
  await page.getByRole('option', { name: 'Cohort B' }).click();
  await d.getByRole('button', { name: 'Filter' }).click();
  expect(seen.some(r => r.url().includes('quiz_id=7') && r.url().includes('section_id=22'))).toBe(true);
});

test('assignments: no Course column, graded / pending status, dash for an ungraded score', async ({ page }) => {
  await open(page, 'assignments');
  const headers = page.getByRole('columnheader');
  await expect(headers).toHaveText(['Learner', 'Instructor', 'Assignment', 'Cohort', 'Submitted', 'Score', 'Status', 'Actions']);
  await expect(page.getByRole('row', { name: /Layla Hassan/ })).toContainText('Graded');
  const pending = page.getByRole('row', { name: /Fatima Al-Rashidi/ });
  await expect(pending).toContainText('Pending');
  await expect(pending).toContainText('Not graded yet');
});

test('cohorts: search, sort, and the enrolled link opens the cohort learners', async ({ page }) => {
  const seen = await open(page, 'cohort');
  await expect(page.getByText('2 cohorts')).toBeVisible();
  await page.getByRole('searchbox').fill('b');
  await expect(page.getByRole('row', { name: /Cohort A/ })).toHaveCount(0);
  await page.getByRole('searchbox').fill('');

  await page.getByRole('button', { name: 'Cohort', exact: true }).click();
  await page.getByRole('button', { name: 'Cohort', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Cohort', exact: true })).toHaveAttribute('aria-sort', 'descending');
  await expect(page.locator('tbody tr').first()).toContainText('Cohort B');

  const link = page.getByRole('button', { name: /Cohort B: 22 of 30 enrolled/ });
  await link.click();
  const d = page.getByRole('dialog', { name: 'Cohort B' });
  await expect(d.getByText('Ali Al-Kaabi')).toBeVisible();
  expect(seen.some(r => r.url().includes('/enrollments') && r.url().includes('group_id=22'))).toBe(true);
  await d.getByRole('button', { name: 'Done' }).click();
  await expect(d).toBeHidden();
  await expect(link).toBeFocused();
});

test('qualifications: read-only list with local search', async ({ page }) => {
  await open(page, 'qualifications');
  // Scoped to the tab panel: the breadcrumb is a list too.
  const items = page.getByRole('tabpanel').getByRole('listitem');
  await expect(items).toHaveCount(2);
  await page.getByRole('searchbox').fill('iso');
  await expect(items).toHaveText(['ISO 45001 Awareness']);
});

test('evaluations: reviews line, course-scoped results, template picker', async ({ page }) => {
  const seen = await open(page, 'evaluations');
  await expect(page.getByText('58 reviews · 3 with comments')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Course Feedback' })).toBeVisible();
  await expect(page.getByText('Star Evaluation').first()).toBeVisible();
  expect(seen.some(r => /\/admin\/evaluations\/5\/results\?course_id=10/.test(r.url()))).toBe(true);

  await page.getByRole('combobox', { name: 'Template' }).click();
  await page.getByRole('option', { name: 'Instructor Feedback' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Instructor Feedback' })).toBeVisible();
  expect(seen.some(r => /\/admin\/evaluations\/6\/results\?course_id=10/.test(r.url()))).toBe(true);
});
