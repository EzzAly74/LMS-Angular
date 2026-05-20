import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { LocaleService } from '../../core/services/locale.service';
import { AuthService } from '../../core/services/auth.service';
import { ADMIN_NAV_GROUPS, NavItem } from './admin-nav.config';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  locale = inject(LocaleService);
  auth   = inject(AuthService);
  router = inject(Router);

  navGroups        = ADMIN_NAV_GROUPS;
  sidebarCollapsed = signal(false);
  searchTerm       = signal('');
  expandedGroups   = signal<Record<string, boolean>>({ 'nav.learning': true });

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
}
