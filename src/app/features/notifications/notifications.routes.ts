import { Routes } from '@angular/router';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/notification-list/notification-list.component').then(m => m.NotificationListComponent),
    title: 'Notifications — 2B Academy',
  },
];
