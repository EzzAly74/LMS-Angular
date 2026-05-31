import { Routes } from '@angular/router';
import { SandboxShellComponent } from './pages/sandbox-shell.component';

/**
 * Isolated routes for the mobile sandbox, mounted at `/test-mobile`.
 * Everything lives under this single parent so the whole `mobile-sandbox`
 * folder + this one route entry can be deleted with zero impact on the
 * production app.
 */
export const SANDBOX_ROUTES: Routes = [
  {
    path: '',
    component: SandboxShellComponent,
    children: [
      { path: '', redirectTo: 'preview', pathMatch: 'full' },
      {
        path: 'preview',
        loadComponent: () =>
          import('./mobile/mobile-preview.component').then((m) => m.MobilePreviewComponent),
      },
      {
        path: 'config',
        loadComponent: () =>
          import('./pages/config-page.component').then((m) => m.ConfigPageComponent),
      },
      {
        path: 'journey',
        loadComponent: () =>
          import('./pages/journey-page.component').then((m) => m.JourneyPageComponent),
      },
      {
        path: 'logs',
        loadComponent: () =>
          import('./pages/logs-page.component').then((m) => m.LogsPageComponent),
      },
      {
        path: 'e/:id',
        loadComponent: () =>
          import('./pages/endpoint-tester.component').then((m) => m.EndpointTesterComponent),
      },
      { path: '**', redirectTo: 'preview' },
    ],
  },
];
