import { Routes } from '@angular/router';

export const CERTIFICATES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/certificate-list/certificate-list.component').then(m => m.CertificateListComponent),
    title: 'Certificates — 2B Academy',
  },
];
