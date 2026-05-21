export interface NavItem {
  label:    string;
  route?:   string;
  icon:     string;
  children?: NavItem[];
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
      { label: 'nav.dashboard', route: '/admin/dashboard', icon: `${NAV_ICONS}/icon-dashboard.svg` },
      { label: 'nav.inbox',     route: '/admin/messages',  icon: `${NAV_ICONS}/icon-inbox.svg` },
    ],
  },
  {
    label: 'nav.group.learning_ops',
    items: [
      {
        label: 'nav.learning',
        icon:  `${NAV_ICONS}/icon-learning.svg`,
        children: [
          { label: 'nav.courses',     route: '/admin/courses',     icon: '' },
          { label: 'nav.assignments', route: '/admin/assignments', icon: '' },
          { label: 'nav.quizzes',     route: '/admin/quizzes',     icon: '' },
          { label: 'nav.ratings',     route: '/admin/ratings',     icon: '' },
        ],
      },
      { label: 'nav.resources', route: '/admin/resources', icon: `${NAV_ICONS}/icon-resources.svg` },
    ],
  },
  {
    label: 'nav.group.competency',
    items: [
      { label: 'nav.job_titles',     route: '/admin/job-titles',     icon: `${NAV_ICONS}/icon-job-titles.svg` },
      { label: 'nav.qualifications', route: '/admin/qualifications', icon: `${NAV_ICONS}/icon-qualifications.svg` },
      { label: 'nav.certificates',   route: '/admin/certificates',   icon: `${NAV_ICONS}/icon-certificates.svg` },
      { label: 'nav.categories',     route: '/admin/categories',     icon: `${NAV_ICONS}/icon-categories.svg` },
      { label: 'nav.reports',        route: '/admin/reports',        icon: `${NAV_ICONS}/icon-reports.svg` },
    ],
  },
  {
    label: 'nav.group.system',
    items: [
      { label: 'nav.users',          route: '/admin/users',       icon: `${NAV_ICONS}/icon-users.svg` },
      { label: 'nav.controllers',    route: '/admin/controllers', icon: `${NAV_ICONS}/icon-controllers.svg` },
      { label: 'nav.roles',          route: '/admin/roles',       icon: `${NAV_ICONS}/icon-roles.svg` },
      { label: 'nav.platform_config',route: '/admin/settings',    icon: `${NAV_ICONS}/icon-settings.svg` },
      { label: 'nav.audit_log',      route: '/admin/audit-log',   icon: `${NAV_ICONS}/icon-audit-log.svg` },
    ],
  },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS
  .flatMap(g => g.items)
  .flatMap(i => i.children ? [i, ...i.children] : [i]);
