import { Routes } from '@angular/router';

export const LEARNERS_ROUTES: Routes = [
  {
    // D3 / Figma 1986:74701. Inherits the parent route's view-users gate,
    // the permission the admin/learners/* API enforces.
    path: '',
    loadComponent: () => import('./pages/learner-list/learner-list.component').then(m => m.LearnerListComponent),
    title: 'Learners — 2B Academy',
  },
  {
    // D3 / Figma 2181:115043.
    path: ':id',
    loadComponent: () => import('./pages/learner-detail/learner-detail.component').then(m => m.LearnerDetailComponent),
    title: 'Learner — 2B Academy',
  },
];
