import { Routes } from '@angular/router';

export const JOB_TITLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/job-title-list/job-title-list.component').then(m => m.JobTitleListComponent),
    title: 'Job Titles — 2B Academy',
  },
  {
    // D1 / Figma 2325:117118. Inherits the parent route's view-job-titles gate.
    path: ':id',
    loadComponent: () => import('./pages/job-title-detail/job-title-detail.component').then(m => m.JobTitleDetailComponent),
    title: 'Job Title — 2B Academy',
  },
];
