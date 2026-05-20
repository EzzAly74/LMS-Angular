import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  // ── Auth (guest-only) ─────────────────────────────────────────────
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // ── Admin dashboard ───────────────────────────────────────────────
  {
    path: 'admin',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./layouts/admin-layout/admin-layout.routes').then(
        (m) => m.ADMIN_LAYOUT_ROUTES,
      ),
  },

  { path: '**', redirectTo: 'auth/login' },
];
