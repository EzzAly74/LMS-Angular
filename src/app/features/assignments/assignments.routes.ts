import { Routes } from '@angular/router';

export const ASSIGNMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/assignment-list/assignment-list.component').then(m => m.AssignmentListComponent),
    title: 'Assignments — 2B Academy',
  },
];
