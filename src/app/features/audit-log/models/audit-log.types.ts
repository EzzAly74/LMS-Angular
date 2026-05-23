/**
 * Shape contracts for the 2026 admin Audit Log redesign.
 *
 * Mirrors the Laravel resource at
 *   App\Http\Resources\Admin\AdminAuditLogResource
 * served by routes/apis/admin-audit-log.php.
 */

export type AdminAuditActorRole =
  | 'admin'
  | 'instructor'
  | 'learner'
  | 'system';

export interface AdminAuditLogItem {
  id: number;
  actor_name: string;
  actor_id: number | null;
  actor_role: AdminAuditActorRole;
  actor_role_label: string;
  avatar_initial: string;
  /** Entity prefix in the Figma "entity → verb" action chip (e.g. `course`). */
  entity_token: string;
  /** Verb suffix in the Figma "entity → verb" action chip (e.g. `published`). */
  action_token: string;
  /** Original `action` column value (kept for tooltips / export parity). */
  action_raw: string;
  model_type: string | null;
  model_id: number | null;
  /** Description blob — used as the "Entity" column copy in the Figma list. */
  entity: string;
  ip_address: string;
  created_at: string | null;
}

export interface AdminAuditLogRoleOption {
  key: 'admin' | 'instructor';
  label: string;
  count: number;
}

export interface AdminAuditLogInstructorOption {
  id: number;
  name: string;
}

export interface AdminAuditLogAdminOption {
  id: number;
  name: string;
}

export interface AdminAuditLogFilterOptions {
  roles: AdminAuditLogRoleOption[];
  instructors: AdminAuditLogInstructorOption[];
  admins: AdminAuditLogAdminOption[];
  actions: string[];
}

export interface AdminAuditLogQuery {
  page?: number;
  per_page?: number;
  search?: string | null;
  role?: 'admin' | 'instructor' | null;
  date_from?: string | null;
  date_to?: string | null;
  instructor_ids?: number[] | null;
}
