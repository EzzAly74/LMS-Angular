import { Routes } from '@angular/router';

export const EXAMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/exam-list/exam-list.component').then(m => m.ExamListComponent),
    title: 'Exams — 2B Academy',
  },
];
