import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ADMIN_NAV_ITEMS } from '../../layouts/admin-layout/admin-nav.config';

/**
 * Route guard enforcing the 2026 dynamic-permission system.
 *
 * Reads the required `view-*` permission from one of:
 *   - `route.data.viewKey`        (explicit, preferred)
 *   - `route.data.viewKeyAny`     (string[]) — pass if ANY of the keys match
 *
 * When the user is missing the permission the guard redirects to the
 * first sidebar item they DO have access to — never to a forbidden URL.
 * Super admins bypass the check entirely.
 *
 * Routes without a `viewKey` are treated as un-gated and pass through
 * (preserves behavior for legacy sub-features not in the Figma matrix).
 */
export const permissionGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot,
): boolean | UrlTree => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const data    = route.data ?? {};
  const required: string | undefined          = data['viewKey'];
  const any:      readonly string[] | undefined = data['viewKeyAny'];

  if (auth.isSuperAdmin()) return true;

  if (required && !auth.hasView(required)) {
    return router.createUrlTree([fallbackRoute(auth)]);
  }

  if (any?.length && !any.some(k => auth.hasView(k))) {
    return router.createUrlTree([fallbackRoute(auth)]);
  }

  return true;
};

/**
 * Pick the first sidebar destination the admin actually has access to.
 * Used as a soft "redirect away from forbidden" target. Falls back to
 * the login page only if the admin holds zero `view-*` permissions —
 * which would itself be a misconfiguration worth surfacing.
 */
export function fallbackRoute(auth: AuthService): string {
  for (const item of ADMIN_NAV_ITEMS) {
    const key = item.viewKey;
    if (!item.route) continue;
    if (!key) continue;            // skip un-gated items as defaults
    if (auth.hasView(key)) return item.route;
  }
  return '/auth/login';
}
