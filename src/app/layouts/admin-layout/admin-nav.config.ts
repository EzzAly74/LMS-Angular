export interface NavItem {
  label:    string;
  route?:   string;
  icon:     string;
  children?: NavItem[];

  /**
   * `view-*` permission key required to see this item. Items without a
   * key are treated as un-gated and remain visible to any authenticated
   * admin (legacy sub-features outside the 2026 Roles matrix).
   *
   * Parent items with `children` may either:
   *   - set their own `viewKey` (group-level gate), or
   *   - leave it undefined and rely on per-child gating (parent stays
   *     visible iff at least one child is visible).
   */
  viewKey?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_ICONS = 'assets/images/nav-icons';

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'nav.group.main',
    items: [
      { label: 'nav.dashboard', route: '/admin/dashboard', icon: `${NAV_ICONS}/icon-dashboard.svg`, viewKey: 'view-dashboard' },
      { label: 'nav.inbox',     route: '/admin/messages',  icon: `${NAV_ICONS}/icon-inbox.svg`,     viewKey: 'view-inbox' },
    ],
  },
  {
    label: 'nav.group.learning_ops',
    items: [
      {
        label: 'nav.learning',
        icon:  `${NAV_ICONS}/icon-learning.svg`,
        children: [
          { label: 'nav.courses',     route: '/admin/courses',     icon: '', viewKey: 'view-courses' },
          { label: 'nav.assignments', route: '/admin/assignments', icon: '', viewKey: 'view-assignments' },
          { label: 'nav.quizzes',     route: '/admin/quizzes',     icon: '', viewKey: 'view-quizzes' },
          { label: 'nav.ratings',     route: '/admin/ratings',     icon: '', viewKey: 'view-ratings' },
        ],
      },
      { label: 'nav.resources', route: '/admin/resources', icon: `${NAV_ICONS}/icon-resources.svg`, viewKey: 'view-resources' },
    ],
  },
  {
    label: 'nav.group.competency',
    items: [
      { label: 'nav.job_titles',     route: '/admin/job-titles',     icon: `${NAV_ICONS}/icon-job-titles.svg`,     viewKey: 'view-job-titles' },
      { label: 'nav.qualifications', route: '/admin/qualifications', icon: `${NAV_ICONS}/icon-qualifications.svg`, viewKey: 'view-qualifications' },
      { label: 'nav.certificates',   route: '/admin/certificates',   icon: `${NAV_ICONS}/icon-certificates.svg`,   viewKey: 'view-certificates' },
      { label: 'nav.categories',     route: '/admin/categories',     icon: `${NAV_ICONS}/icon-categories.svg`,     viewKey: 'view-categories' },
      { label: 'nav.reports',        route: '/admin/reports',        icon: `${NAV_ICONS}/icon-reports.svg`,        viewKey: 'view-reports' },
    ],
  },
  {
    label: 'nav.group.system',
    items: [
      { label: 'nav.users',           route: '/admin/users',       icon: `${NAV_ICONS}/icon-users.svg`,       viewKey: 'view-users' },
      { label: 'nav.controllers',     route: '/admin/controllers', icon: `${NAV_ICONS}/icon-controllers.svg`, viewKey: 'view-controllers' },
      { label: 'nav.roles',           route: '/admin/roles',       icon: `${NAV_ICONS}/icon-roles.svg`,       viewKey: 'view-roles' },
      { label: 'nav.platform_config', route: '/admin/settings',    icon: `${NAV_ICONS}/icon-settings.svg`,    viewKey: 'view-platform-config' },
      { label: 'nav.audit_log',       route: '/admin/audit-log',   icon: `${NAV_ICONS}/icon-audit-log.svg`,   viewKey: 'view-audit-log' },
    ],
  },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS
  .flatMap(g => g.items)
  .flatMap(i => i.children ? [i, ...i.children] : [i]);
