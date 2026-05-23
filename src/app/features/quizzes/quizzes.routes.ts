import { Routes } from '@angular/router';

export const QUIZZES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/quizzes-list/quizzes-list.component')
        .then(m => m.QuizzesListComponent),
    title: 'Quizzes — 2B Academy',
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/quiz-form/quiz-form.component')
        .then(m => m.QuizFormComponent),
    title: 'Create Quiz — 2B Academy',
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
      import('./pages/quiz-form/quiz-form.component')
        .then(m => m.QuizFormComponent),
    title: 'Edit Quiz — 2B Academy',
  },
];
