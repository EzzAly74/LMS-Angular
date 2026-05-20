import { Routes } from '@angular/router';

export const ARTICLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/article-list/article-list.component').then(m => m.ArticleListComponent),
    title: 'Articles — 2B Academy',
  },
];
