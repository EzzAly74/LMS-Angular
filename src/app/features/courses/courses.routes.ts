import { Routes } from '@angular/router';

export const COURSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/course-list/course-list.component').then(m => m.CourseListComponent),
    title: 'Courses — 2B Academy',
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/course-detail/course-detail.component').then(m => m.CourseDetailComponent),
    title: 'Course Detail — 2B Academy',
  },
];
