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

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'nav.group.main',
    items: [
      { label: 'nav.dashboard', route: '/admin/dashboard', icon: 'pi pi-chart-bar' },
      { label: 'nav.inbox',     route: '/admin/messages',  icon: 'pi pi-envelope' },
    ],
  },
  {
    label: 'nav.group.learning_ops',
    items: [
      {
        label: 'nav.learning',
        icon:  'pi pi-book',
        children: [
          { label: 'nav.courses',     route: '/admin/courses',     icon: 'pi pi-circle-fill' },
          { label: 'nav.assignments', route: '/admin/assignments', icon: 'pi pi-circle-fill' },
          { label: 'nav.quizzes',     route: '/admin/quizzes',     icon: 'pi pi-circle-fill' },
          { label: 'nav.ratings',     route: '/admin/ratings',     icon: 'pi pi-circle-fill' },
        ],
      },
      { label: 'nav.resources', route: '/admin/resources', icon: 'pi pi-folder-open' },
    ],
  },
  {
    label: 'nav.group.competency',
    items: [
      { label: 'nav.job_titles',     route: '/admin/job-titles',     icon: 'pi pi-briefcase' },
      { label: 'nav.qualifications', route: '/admin/qualifications', icon: 'pi pi-verified' },
      { label: 'nav.certificates',   route: '/admin/certificates',   icon: 'pi pi-id-card' },
      { label: 'nav.categories',     route: '/admin/categories',     icon: 'pi pi-tags' },
      { label: 'nav.reports',        route: '/admin/reports',        icon: 'pi pi-chart-line' },
    ],
  },
  {
    label: 'nav.group.system',
    items: [
      { label: 'nav.users',          route: '/admin/users',     icon: 'pi pi-users' },
      { label: 'nav.platform_config',route: '/admin/settings',  icon: 'pi pi-cog' },
      { label: 'nav.audit_log',      route: '/admin/audit-log', icon: 'pi pi-history' },
    ],
  },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS
  .flatMap(g => g.items)
  .flatMap(i => i.children ? [i, ...i.children] : [i]);
