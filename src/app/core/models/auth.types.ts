/** The four actions of the permission matrix (D-073). */
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

/** `all` sees every course; `assigned` only the courses the account teaches (D-074). */
export type CourseScope = 'all' | 'assigned';

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

  /**
   * The full matrix (D-073): `{action}-{section}`, e.g. `edit-courses`.
   * Drives which create / edit / delete controls render; the server
   * enforces the same permissions on every request.
   */
  permissions?: string[];

  /** Whether this account is limited to the courses it teaches (D-074). */
  course_scope?: CourseScope;
}
