import { Routes } from '@angular/router';

export const BLOGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/blog-list/blog-list.component').then(m => m.BlogListComponent),
    title: 'Blogs — 2B Academy',
  },
  {
    path: 'add',
    loadComponent: () => import('./pages/blog-form/blog-form.component').then(m => m.BlogFormComponent),
    title: 'Add Blog — 2B Academy',
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pages/blog-form/blog-form.component').then(m => m.BlogFormComponent),
    title: 'Edit Blog — 2B Academy',
  },
];
