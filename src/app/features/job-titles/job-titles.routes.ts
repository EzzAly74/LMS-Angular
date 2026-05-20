import { Routes } from '@angular/router';

export const JOB_TITLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/job-title-list/job-title-list.component').then(m => m.JobTitleListComponent),
    title: 'Job Titles — 2B Academy',
  },
];
