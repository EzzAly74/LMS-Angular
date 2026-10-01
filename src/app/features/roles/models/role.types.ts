/**
 * Shape contracts for the admin Roles screen.
 *
 * Mirrors the payloads emitted by the Laravel admin endpoints
 *   GET /api/v1/admin/roles
 *   GET /api/v1/admin/roles/sections
 *   GET /api/v1/admin/roles/{id}
 *   POST/PUT/DELETE /api/v1/admin/roles[/{id}]
 *
 * Permissions form a matrix (D-073): one row per Dashboard section, one
 * column per action, named `{action}-{section}` (`edit-courses`).
 */

import type { CourseScope, PermissionAction } from '../../../core/models/auth.types';

export type AdminRoleColor = 'teal' | 'green' | 'orange' | 'red' | 'blue';

export interface AdminRoleAction {
  key: PermissionAction;
  label: string;
}

export interface AdminRoleSectionItem {
  /** Section key, e.g. `courses`. */
  key: string;
  label: string;
  /** The actions this section supports, in column order. */
  actions: PermissionAction[];
  /** Organisation-wide data: not available to roles limited to their courses (D-074). */
  org_wide: boolean;
}

export interface AdminRoleSectionGroup {
  /** Stable identifier — `main`, `learning_operation`, `manage_competency`, `system`. */
  key: string;
  label: string;
  items: AdminRoleSectionItem[];
}

export interface AdminRoleSectionCatalog {
  /** Number of permissions on the form. */
  total: number;
  sections_total: number;
  actions: AdminRoleAction[];
  groups: AdminRoleSectionGroup[];
}

export interface AdminRoleListItem {
  id: number;
  machine_name: string;
  guard_name: string;
  name: string;
  name_en: string | null;
  name_ar: string | null;
  description: string | null;
  description_en: string | null;
  description_ar: string | null;
  color: AdminRoleColor;
  course_scope: CourseScope;
  is_system: boolean;
  is_super_admin: boolean;
  /** The signed-in admin may change this role (not their own, not a super admin's). */
  can_manage: boolean;
  can_delete: boolean;
  user_count: number;
  permissions: string[];
  permission_count: number;
  permission_total: number;
  view_keys: string[];
  view_count: number;
  view_total: number;
  view_percentage: number;
  avatar_initial: string;
  created_at: string | null;
}

export type AdminRoleDetail = AdminRoleListItem;

export interface AdminRoleListResponse {
  total_views: number;
  total_permissions: number;
  roles: AdminRoleListItem[];
}

export interface AdminRoleStorePayload {
  name_en: string;
  name_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
  color?: AdminRoleColor;
  course_scope?: CourseScope;
  permissions?: string[];
}

export type AdminRoleUpdatePayload = Partial<AdminRoleStorePayload>;
