export interface AuthAdmin {
  id: number;
  name: string;
  email: string;
  roles?: string[];

  /**
   * Distinct `view-*` permission keys the admin holds through their
   * assigned roles. Source of truth for sidebar visibility and route
   * activation. The backend always emits an array (never null) so the
   * client never has to defensive-check.
   */
  view_keys?: string[];

  /**
   * Fast-path flag — `true` when the admin holds the legacy
   * `superAdmin` role. Equivalent to "has all view-* permissions".
   */
  is_super_admin?: boolean;
}
