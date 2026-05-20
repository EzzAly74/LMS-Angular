import { Routes } from '@angular/router';

export const INSTRUCTORS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/instructor-list/instructor-list.component').then(m => m.InstructorListComponent),
    title: 'Instructors — 2B Academy',
  },
];
