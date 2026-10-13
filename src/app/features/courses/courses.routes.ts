import { Routes } from '@angular/router';

export const COURSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/course-list/course-list.component').then(m => m.CourseListComponent),
    title: 'Courses — 2B Academy',
  },
  {
    path: 'new', data: { permission: 'create-courses' },
    loadComponent: () => import('./pages/course-form/course-form.component').then(m => m.CourseFormComponent),
    title: 'Add Course — 2B Academy',
  },
  {
    path: ':id/edit', data: { permission: 'edit-courses' },
    loadComponent: () => import('./pages/course-form/course-form.component').then(m => m.CourseFormComponent),
    title: 'Edit Course — 2B Academy',
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/course-detail/course-detail.component').then(m => m.CourseDetailComponent),
    title: 'Course Detail — 2B Academy',
  },
];
