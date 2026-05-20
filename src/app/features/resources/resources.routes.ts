import { Routes } from '@angular/router';

export const RESOURCES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/resource-list/resource-list.component').then(m => m.ResourceListComponent),
    title: 'Resources — 2B Academy',
  },
  {
    path: 'add',
    loadComponent: () => import('./pages/resource-add/resource-add.component').then(m => m.ResourceAddComponent),
    title: 'Add Resource — 2B Academy',
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/resource-detail/resource-detail.component').then(m => m.ResourceDetailComponent),
    title: 'Resource — 2B Academy',
  },
];
