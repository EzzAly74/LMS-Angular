import { Routes } from '@angular/router';

export const ROLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/role-list/role-list.component').then(
        (m) => m.RoleListComponent,
      ),
    title: 'Roles — 2B Academy',
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/role-form/role-form.component').then(
        (m) => m.RoleFormComponent,
      ),
    title: 'Create Role — 2B Academy',
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/role-form/role-form.component').then(
        (m) => m.RoleFormComponent,
      ),
    title: 'Edit Role — 2B Academy',
  },
];
