import { Routes } from '@angular/router';

export const QUALIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/qualification-list/qualification-list.component').then(m => m.QualificationListComponent),
    title: 'Qualifications — 2B Academy',
  },
];
