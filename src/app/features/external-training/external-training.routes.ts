import { Routes } from '@angular/router';

export const EXTERNAL_TRAINING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/request-list/request-list.component').then(m => m.ExternalTrainingListComponent),
    title: 'External Training — 2B Academy',
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/request-review/request-review.component').then(m => m.ExternalTrainingReviewComponent),
    title: 'Review External Training — 2B Academy',
  },
];
