import { Routes } from '@angular/router';

export const FORMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/form-list/form-list.component').then(m => m.FormListComponent),
    title: 'Forms — 2B Academy',
  },
];
