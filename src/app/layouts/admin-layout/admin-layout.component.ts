import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { LocaleService } from '../../core/services/locale.service';
import { AuthService } from '../../core/services/auth.service';
import { ADMIN_NAV_GROUPS, NavGroup, NavItem } from './admin-nav.config';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { NasConfirmModalComponent } from '../../shared/nas/nas-confirm-modal.component';
import { NasIconComponent } from '../../shared/nas/nas-icon.component';
import { NotificationsDrawerComponent } from '../../shared/nas/notifications-drawer/notifications-drawer.component';
import { NotificationsDrawerService } from '../../shared/nas/notifications-drawer/notifications-drawer.service';
import { withLocaleReload } from '../../core/utils/with-locale-reload';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    FormsModule,
    ToastModule,
    ConfirmDialogModule,
    OverlayPanelModule,
    NasConfirmModalComponent,
    NasIconComponent,
    NotificationsDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  locale          = inject(LocaleService);
  auth            = inject(AuthService);
  router          = inject(Router);
  notifsDrawer    = inject(NotificationsDrawerService);
  private t       = inject(TranslateService);

  /** Bumped on every locale switch so `computed()` derivations that read
   *  `TranslateService.instant()` (not signal-tracked) re-evaluate. */
  private langTick = signal(0);

  constructor() {
    withLocaleReload(() => this.langTick.update(v => v + 1));
  }

  sidebarCollapsed = signal(false);
  logoutConfirmOpen = signal(false);

  /**
   * Sidebar groups filtered by the current admin's `view_keys`.
   *
   *   - Leaf items: kept only if their `viewKey` is either unset
   *     (legacy un-gated) or held by the admin.
   *   - Parent items with children: kept only if at least one child
   *     survives the filter (also dropped when the parent itself has
   *     a `viewKey` the admin lacks).
   *   - Groups with zero surviving items are dropped entirely.
   *
   * Recomputes automatically when the auth signal updates (login,
   * /me refresh, logout).
   */
  navGroups = computed<NavGroup[]>(() => {
    const auth = this.auth;
    return ADMIN_NAV_GROUPS
      .map<NavGroup>(group => ({
        label: group.label,
        items: group.items.flatMap<NavItem>(item => {
          // Parent with children — recurse, then drop if none survive.
          if (item.children?.length) {
            if (item.viewKey && !auth.hasView(item.viewKey)) return [];
            const visibleChildren = item.children.filter(c => auth.hasView(c.viewKey));
            if (!visibleChildren.length) return [];
            return [{ ...item, children: visibleChildren }];
          }
          return auth.hasView(item.viewKey) ? [item] : [];
        }),
      }))
      .filter(g => g.items.length > 0);
  });


  searchTerm       = signal('');
  searchOpen       = signal(false);
  expandedGroups   = signal<Record<string, boolean>>({ 'nav.learning': true });

  /** Visible-to-current-admin nav items flattened to leaf rows that own a
   *  concrete `route`. Used to drive the navbar quick-search dropdown. */
  private flatNavItems = computed(() => {
    const groups = this.navGroups();
    const out: { label: string; route: string; icon: string; parent?: string }[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        if (item.children?.length) {
          for (const child of item.children) {
            if (child.route) {
              out.push({ label: child.label, route: child.route, icon: child.icon, parent: item.label });
            }
          }
        } else if (item.route) {
          out.push({ label: item.label, route: item.route, icon: item.icon });
        }
      }
    }
    return out;
  });

  /** Localised sidebar items that match the current search term. Empty
   *  while the term is blank so the dropdown stays closed. */
  searchMatches = computed(() => {
    this.langTick();
    const raw = this.searchTerm().trim().toLowerCase();
    if (!raw) return [];
    return this.flatNavItems()
      .map(item => ({
        ...item,
        translatedLabel: this.t.instant(item.label) as string,
        translatedParent: item.parent ? (this.t.instant(item.parent) as string) : '',
      }))
      .filter(m =>
        m.translatedLabel.toLowerCase().includes(raw) ||
        (m.translatedParent && m.translatedParent.toLowerCase().includes(raw)),
      )
      .slice(0, 8);
  });

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.searchOpen.set(term.trim().length > 0);
  }

  onSearchFocus(): void {
    if (this.searchTerm().trim().length > 0) this.searchOpen.set(true);
  }

  /** Close the dropdown after the click outside settles. Uses a small
   *  delay so a click on a match item still fires before close. */
  onSearchBlur(): void {
    setTimeout(() => this.searchOpen.set(false), 150);
  }

  /** Enter → navigate to the top match. */
  submitSearch(): void {
    const top = this.searchMatches()[0];
    if (top) this.navigateMatch(top.route);
  }

  /** Click on a match row → navigate + reset the search bar. */
  navigateMatch(route: string): void {
    this.searchTerm.set('');
    this.searchOpen.set(false);
    this.router.navigateByUrl(route);
  }

  private currentUrl = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)),
    { initialValue: null },
  );

  readonly url = computed(() => {
    this.currentUrl();
    return this.router.url;
  });

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  toggleGroup(label: string): void {
    this.expandedGroups.update(g => ({ ...g, [label]: !g[label] }));
  }

  isGroupExpanded(label: string): boolean {
    return !!this.expandedGroups()[label];
  }

  isItemActive(item: NavItem): boolean {
    if (item.route && this.url().startsWith(item.route)) return true;
    return !!item.children?.some(c => c.route && this.url().startsWith(c.route));
  }

  toggleLocale(locale: 'en' | 'ar'): void {
    if (this.locale.locale() !== locale) this.locale.switch(locale);
  }

  /** First initial of the signed-in admin, used by the avatar bubble. */
  profileInitial = computed(() => {
    const name = this.auth.currentAdmin()?.name?.trim();
    return (name?.[0] ?? 'A').toUpperCase();
  });

  /** Display name shown beneath "Welcome back". */
  profileName = computed(() => this.auth.currentAdmin()?.name ?? 'Admin');

  /** Open the Figma logout-confirmation dialog instead of signing out directly. */
  requestLogout(): void {
    this.logoutConfirmOpen.set(true);
  }

  /** "Yes, logout" — flush the session and route to /auth/login. */
  confirmLogout(): void {
    this.logoutConfirmOpen.set(false);
    this.auth.logout();
  }

  /** "No, keep it logged in" — just close the modal. */
  cancelLogout(): void {
    this.logoutConfirmOpen.set(false);
  }
}
