import { Routes } from '@angular/router';

export const AUDIT_LOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/audit-log-list/audit-log-list.component').then(m => m.AuditLogListComponent),
    title: 'Audit Log — 2B Academy',
  },
];
