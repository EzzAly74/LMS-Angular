import { Routes } from '@angular/router';

export const ATTENDANCE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/attendance-list/attendance-list.component').then(m => m.AttendanceListComponent),
    title: 'Attendance — 2B Academy',
  },
];
