import { Routes } from '@angular/router';

export const RATINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/ratings-list/ratings-list.component').then(m => m.RatingsListComponent),
    title: 'Ratings — 2B Academy',
  },
];
