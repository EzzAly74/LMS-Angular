import { Routes } from '@angular/router';

/**
 * D4 - Evaluation (Figma 2009:88432, 2169:108198, 2017:52260, 2169:108801 /
 * 2169:109264). Inherits the parent route's view-evaluations gate, the
 * permission every admin/evaluations/* endpoint enforces (DB-06).
 * Static segments come before `:id`, as in the API.
 */
export const EVALUATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/template-list/template-list.component').then(m => m.EvaluationTemplateListComponent),
    title: 'Evaluation Templates — 2B Academy',
  },
  {
    // Figma 2409:132793 / 2409:133222.
    path: 'new', data: { permission: 'create-evaluations' },
    loadComponent: () => import('./pages/template-builder/template-builder.component').then(m => m.EvaluationTemplateBuilderComponent),
    title: 'Create Evaluation — 2B Academy',
  },
  {
    path: ':id/edit', data: { permission: 'edit-evaluations' },
    loadComponent: () => import('./pages/template-builder/template-builder.component').then(m => m.EvaluationTemplateBuilderComponent),
    title: 'Edit Evaluation — 2B Academy',
  },
  {
    path: 'scores',
    loadComponent: () => import('./pages/score-list/score-list.component').then(m => m.EvaluationScoreListComponent),
    title: 'Learner Scores — 2B Academy',
  },
  {
    path: 'scores/:learner/:course',
    loadComponent: () => import('./pages/submission/submission.component').then(m => m.EvaluationSubmissionComponent),
    title: 'Evaluation Result — 2B Academy',
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/template-results/template-results.component').then(m => m.EvaluationTemplateResultsComponent),
    title: 'Evaluation Results — 2B Academy',
  },
];
