import { Routes } from '@angular/router';

export const QUIZZES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/quizzes-list/quizzes-list.component').then(m => m.QuizzesListComponent),
    title: 'Quizzes — 2B Academy',
  },
];
