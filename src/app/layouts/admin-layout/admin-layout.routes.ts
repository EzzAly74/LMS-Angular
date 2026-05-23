import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout.component';
import { permissionGuard } from '../../core/guards/permission.guard';

/**
 * Per-route `data.viewKey` ties each admin URL to the 2026 dashboard
 * view-permission matrix. The `permissionGuard` (registered globally
 * here) enforces those keys against the current admin's `view_keys`.
 *
 * Routes without a `viewKey` are intentionally left un-gated — they
 * correspond to legacy sub-features outside the Figma matrix and remain
 * accessible to any authenticated admin.
 */
export const ADMIN_LAYOUT_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivateChild: [permissionGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // ── Dashboard ──────────────────────────────────────────────────
      {
        path: 'dashboard',
        loadComponent: () => import('../../features/dashboard/pages/admin-dashboard/admin-dashboard.component')
          .then(m => m.AdminDashboardComponent),
        title: 'Dashboard — 2B Academy',
        data: { viewKey: 'view-dashboard' },
      },

      // ── Course management ──────────────────────────────────────────
      { path: 'courses',        loadChildren: () => import('../../features/courses/courses.routes').then(m => m.COURSES_ROUTES),                 data: { viewKey: 'view-courses' } },
      { path: 'categories',     loadChildren: () => import('../../features/categories/categories.routes').then(m => m.CATEGORIES_ROUTES),       data: { viewKey: 'view-categories' } },
      { path: 'instructors',    loadChildren: () => import('../../features/instructors/instructors.routes').then(m => m.INSTRUCTORS_ROUTES) },  // legacy, un-gated
      { path: 'resources',      loadChildren: () => import('../../features/resources/resources.routes').then(m => m.RESOURCES_ROUTES),           data: { viewKey: 'view-resources' } },

      // ── Learner management ─────────────────────────────────────────
      { path: 'users',          loadChildren: () => import('../../features/users/users.routes').then(m => m.USERS_ROUTES),                       data: { viewKey: 'view-users' } },
      { path: 'assignments',    loadChildren: () => import('../../features/assignments/assignments.routes').then(m => m.ASSIGNMENTS_ROUTES),     data: { viewKey: 'view-assignments' } },
      { path: 'attendance',     loadChildren: () => import('../../features/attendance/attendance.routes').then(m => m.ATTENDANCE_ROUTES) },      // legacy, un-gated
      { path: 'certificates',   loadChildren: () => import('../../features/certificates/certificates.routes').then(m => m.CERTIFICATES_ROUTES), data: { viewKey: 'view-certificates' } },
      { path: 'evaluations',    loadChildren: () => import('../../features/evaluations/evaluations.routes').then(m => m.EVALUATIONS_ROUTES) },   // legacy, un-gated
      { path: 'exams',          loadChildren: () => import('../../features/exams/exams.routes').then(m => m.EXAMS_ROUTES) },                     // legacy, un-gated
      { path: 'quizzes',        loadChildren: () => import('../../features/quizzes/quizzes.routes').then(m => m.QUIZZES_ROUTES),                 data: { viewKey: 'view-quizzes' } },

      // ── Organisation ──────────────────────────────────────────────
      { path: 'job-titles',     loadChildren: () => import('../../features/job-titles/job-titles.routes').then(m => m.JOB_TITLES_ROUTES),       data: { viewKey: 'view-job-titles' } },
      { path: 'qualifications', loadChildren: () => import('../../features/qualifications/qualifications.routes').then(m => m.QUALIFICATIONS_ROUTES), data: { viewKey: 'view-qualifications' } },
      { path: 'roles',          loadChildren: () => import('../../features/roles/roles.routes').then(m => m.ROLES_ROUTES),                       data: { viewKey: 'view-roles' } },
      { path: 'controllers',    loadChildren: () => import('../../features/controllers/controllers.routes').then(m => m.CONTROLLERS_ROUTES),       data: { viewKey: 'view-controllers' } },

      // ── Communication ─────────────────────────────────────────────
      { path: 'messages',       loadChildren: () => import('../../features/messages/messages.routes').then(m => m.MESSAGES_ROUTES),             data: { viewKey: 'view-inbox' } },
      { path: 'notifications',  loadChildren: () => import('../../features/notifications/notifications.routes').then(m => m.NOTIFICATIONS_ROUTES) }, // legacy
      { path: 'articles',       loadChildren: () => import('../../features/articles/articles.routes').then(m => m.ARTICLES_ROUTES) },               // legacy
      { path: 'forms',          loadChildren: () => import('../../features/forms/forms.routes').then(m => m.FORMS_ROUTES) },                        // legacy

      // ── Analytics & settings ──────────────────────────────────────
      { path: 'ratings',        loadChildren: () => import('../../features/ratings/ratings.routes').then(m => m.RATINGS_ROUTES),                 data: { viewKey: 'view-ratings' } },
      { path: 'reports',        loadChildren: () => import('../../features/reports/reports.routes').then(m => m.REPORTS_ROUTES),                 data: { viewKey: 'view-reports' } },
      { path: 'audit-log',      loadChildren: () => import('../../features/audit-log/audit-log.routes').then(m => m.AUDIT_LOG_ROUTES),           data: { viewKey: 'view-audit-log' } },
      {
        path: 'settings',
        loadComponent: () => import('../../features/settings/pages/settings.component').then(m => m.SettingsComponent),
        title: 'Settings — 2B Academy',
        data: { viewKey: 'view-platform-config' },
      },
    ],
  },
];
