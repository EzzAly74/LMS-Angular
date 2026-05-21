import { Routes } from '@angular/router';

/**
 * "Controllers" is the customer-facing label for admin operators
 * (the `/api/v1/admins` Laravel endpoint).
 */
export const CONTROLLERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/controller-list/controller-list.component').then(
        m => m.ControllerListComponent,
      ),
    title: 'Controllers — 2B Academy',
  },
];
