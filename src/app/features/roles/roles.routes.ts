import { Routes } from '@angular/router';

export const ROLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/role-list/role-list.component').then(m => m.RoleListComponent),
    title: 'Roles — 2B Academy',
  },
];
