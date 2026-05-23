/**
 * Shape contracts for the 2026 admin Roles redesign.
 *
 * Mirrors the payloads emitted by the Laravel admin endpoints
 *   GET /api/v1/admin/roles
 *   GET /api/v1/admin/roles/sections
 *   GET /api/v1/admin/roles/{id}
 *   POST/PUT/DELETE /api/v1/admin/roles[/{id}]
 */

export type AdminRoleColor = 'teal' | 'green' | 'orange' | 'red' | 'blue';

export interface AdminRoleSectionItem {
  /** Permission name e.g. `view-dashboard`. */
  key: string;
  label: string;
}

export interface AdminRoleSectionGroup {
  /** Stable identifier — `main`, `learning_operation`, `manage_competency`, `system`. */
  key: string;
  label: string;
  items: AdminRoleSectionItem[];
}

export interface AdminRoleSectionCatalog {
  total: number;
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
  is_system: boolean;
  user_count: number;
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
  roles: AdminRoleListItem[];
}

export interface AdminRoleStorePayload {
  name_en: string;
  name_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
  color?: AdminRoleColor;
  view_keys?: string[];
}

export type AdminRoleUpdatePayload = Partial<AdminRoleStorePayload>;
