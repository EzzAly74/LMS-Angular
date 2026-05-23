import { Routes } from '@angular/router';

export const ASSIGNMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/assignment-list/assignment-list.component')
        .then(m => m.AssignmentListComponent),
    title: 'Assignments — 2B Academy',
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/assignment-form/assignment-form.component')
        .then(m => m.AssignmentFormComponent),
    title: 'Create Assignment — 2B Academy',
  },
  {
    path: 'submissions/:id',
    loadComponent: () =>
      import('./pages/submission-detail/submission-detail.component')
        .then(m => m.SubmissionDetailComponent),
    title: 'Submission Details — 2B Academy',
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/assignment-form/assignment-form.component')
        .then(m => m.AssignmentFormComponent),
    title: 'Edit Assignment — 2B Academy',
  },
];
