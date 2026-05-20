import { Routes } from '@angular/router';

export const MESSAGES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/messages-list/messages-list.component').then(m => m.MessagesListComponent),
    title: 'Messages — 2B Academy',
  },
];
