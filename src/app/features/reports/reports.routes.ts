import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/reports/reports.component').then(m => m.ReportsComponent),
    title: 'Reports — 2B Academy',
  },
];
