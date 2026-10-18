/**
 * Each report card's icon, as drawn on the report list (Figma 2201:81876).
 * Decorative: the card's title names the report.
 */
const BASE = 'assets/icons/figma/reports';

export const REPORT_ICONS: Readonly<Record<string, string>> = {
  'compliance-by-job-title': `${BASE}/card-shield-check.svg`,
  'individual-compliance': `${BASE}/card-user.svg`,
  'attendance': `${BASE}/card-check-circle.svg`,
  'completion': `${BASE}/card-graduation-cap.svg`,
  'quiz-scores': `${BASE}/card-chart-bar.svg`,
  'assignment-scores': `${BASE}/card-chart-bar.svg`,
  'certificate-status': `${BASE}/card-star.svg`,
  'evaluation-summary': `${BASE}/card-star.svg`,
  'evaluation-responses': `${BASE}/card-star.svg`,
  'external-training': `${BASE}/card-graduation-cap.svg`,
};

export const DEFAULT_REPORT_ICON = `${BASE}/card-chart-bar.svg`;

/**
 * The evaluation reports are one card, "Evaluation Scores" (Figma 2201:82006);
 * the response detail opens from the summary page.
 */
export const EVALUATION_SUMMARY = 'evaluation-summary';
export const EVALUATION_RESPONSES = 'evaluation-responses';
