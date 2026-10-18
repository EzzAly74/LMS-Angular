import { Routes } from '@angular/router';

/** The NAS reports (D-112): the report list, then one report by its key. */
export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/report-list/report-list.component').then(m => m.ReportListComponent),
    title: 'Reports — 2B Academy',
  },
  {
    path: ':key',
    loadComponent: () => import('./pages/report-view/report-view.component').then(m => m.ReportViewComponent),
    title: 'Reports — 2B Academy',
  },
];
