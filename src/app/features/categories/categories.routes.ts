import { Routes } from '@angular/router';

export const CATEGORIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/category-list/category-list.component').then(m => m.CategoryListComponent),
    title: 'Categories — 2B Academy',
  },
];
