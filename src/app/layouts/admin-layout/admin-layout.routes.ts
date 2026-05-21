import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout.component';

export const ADMIN_LAYOUT_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // ── Dashboard ──────────────────────────────────────────────────
      {
        path: 'dashboard',
        loadComponent: () => import('../../features/dashboard/pages/admin-dashboard/admin-dashboard.component')
          .then(m => m.AdminDashboardComponent),
        title: 'Dashboard — 2B Academy',
      },

      // ── Course management ──────────────────────────────────────────
      { path: 'courses',        loadChildren: () => import('../../features/courses/courses.routes').then(m => m.COURSES_ROUTES) },
      { path: 'categories',     loadChildren: () => import('../../features/categories/categories.routes').then(m => m.CATEGORIES_ROUTES) },
      { path: 'instructors',    loadChildren: () => import('../../features/instructors/instructors.routes').then(m => m.INSTRUCTORS_ROUTES) },
      { path: 'resources',      loadChildren: () => import('../../features/resources/resources.routes').then(m => m.RESOURCES_ROUTES) },

      // ── Learner management ─────────────────────────────────────────
      { path: 'users',          loadChildren: () => import('../../features/users/users.routes').then(m => m.USERS_ROUTES) },
      { path: 'assignments',    loadChildren: () => import('../../features/assignments/assignments.routes').then(m => m.ASSIGNMENTS_ROUTES) },
      { path: 'attendance',     loadChildren: () => import('../../features/attendance/attendance.routes').then(m => m.ATTENDANCE_ROUTES) },
      { path: 'certificates',   loadChildren: () => import('../../features/certificates/certificates.routes').then(m => m.CERTIFICATES_ROUTES) },
      { path: 'evaluations',    loadChildren: () => import('../../features/evaluations/evaluations.routes').then(m => m.EVALUATIONS_ROUTES) },
      { path: 'exams',          loadChildren: () => import('../../features/exams/exams.routes').then(m => m.EXAMS_ROUTES) },
      { path: 'quizzes',        loadChildren: () => import('../../features/quizzes/quizzes.routes').then(m => m.QUIZZES_ROUTES) },

      // ── Organisation ──────────────────────────────────────────────
      { path: 'job-titles',     loadChildren: () => import('../../features/job-titles/job-titles.routes').then(m => m.JOB_TITLES_ROUTES) },
      { path: 'qualifications', loadChildren: () => import('../../features/qualifications/qualifications.routes').then(m => m.QUALIFICATIONS_ROUTES) },
      { path: 'roles',          loadChildren: () => import('../../features/roles/roles.routes').then(m => m.ROLES_ROUTES) },
      { path: 'controllers',    loadChildren: () => import('../../features/controllers/controllers.routes').then(m => m.CONTROLLERS_ROUTES) },

      // ── Communication ─────────────────────────────────────────────
      { path: 'messages',       loadChildren: () => import('../../features/messages/messages.routes').then(m => m.MESSAGES_ROUTES) },
      { path: 'notifications',  loadChildren: () => import('../../features/notifications/notifications.routes').then(m => m.NOTIFICATIONS_ROUTES) },
      { path: 'articles',       loadChildren: () => import('../../features/articles/articles.routes').then(m => m.ARTICLES_ROUTES) },
      { path: 'forms',          loadChildren: () => import('../../features/forms/forms.routes').then(m => m.FORMS_ROUTES) },

      // ── Analytics & settings ──────────────────────────────────────
      { path: 'ratings',        loadChildren: () => import('../../features/ratings/ratings.routes').then(m => m.RATINGS_ROUTES) },
      { path: 'reports',        loadChildren: () => import('../../features/reports/reports.routes').then(m => m.REPORTS_ROUTES) },
      { path: 'audit-log',      loadChildren: () => import('../../features/audit-log/audit-log.routes').then(m => m.AUDIT_LOG_ROUTES) },
      {
        path: 'settings',
        loadComponent: () => import('../../features/settings/pages/settings.component').then(m => m.SettingsComponent),
        title: 'Settings — 2B Academy',
      },
    ],
  },
];
