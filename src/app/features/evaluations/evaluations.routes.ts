import { Routes } from '@angular/router';

export const EVALUATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/evaluation-list/evaluation-list.component').then(m => m.EvaluationListComponent),
    title: 'Evaluations — 2B Academy',
  },
];
