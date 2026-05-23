/**
 * Shape contracts for the 2026 admin Users redesign.
 *
 * Mirrors the Laravel resources at
 *   App\Http\Resources\Admin\AdminUserListResource
 *   App\Http\Resources\Admin\AdminUserDetailResource
 * served by routes/apis/admin-users.php.
 */

export type AdminUserRole   = 'admin' | 'instructor' | 'learner';
export type AdminUserStatus = 'active' | 'inactive' | 'deactivated';
export type AdminUserSource = 'user' | 'instructor' | 'admin';
export type LearnerType     = 'online' | 'offline' | 'hybrid';

export interface AdminUserListItem {
  /** Numeric id within the source table. */
  id: number;
  /** Which underlying table the row lives in. */
  source: AdminUserSource;
  /** "{source}:{id}" — useful as a stable trackBy key. */
  composite_id: string;
  name: string | null;
  name_en: string | null;
  name_ar: string | null;
  email: string | null;
  phone: string | null;
  machine_code: string | null;
  department_name: string | null;
  job_title: string | null;
  role: string;
  role_key: AdminUserRole;
  status: AdminUserStatus;
  last_active_at: string | null;
  compliance_pct: number | null;
  has_compliance: boolean;
  enrolled_courses_count: number;
  avatar_initial: string;
  created_at: string | null;
}

export type AdminUserDetail = AdminUserListItem;

export interface AdminUserSummary {
  total_users: number;
  instructors: number;
  admins:      number;
  inactive:    number;
}

export interface AdminUserRoleOption {
  key:   AdminUserRole;
  label: string;
  count: number;
}

export interface AdminUserFilterOptions {
  roles:       AdminUserRoleOption[];
  instructors: Array<{ id: number; name: string; email: string | null }>;
  job_titles:  string[];
}

export interface AdminUserStorePayload {
  name_en: string;
  name_ar: string;
  email: string;
  role: AdminUserRole;
  job_title?: string | null;
  department_name?: string | null;
  phone?: string | null;
  learner_type?: LearnerType | null;
}

export type AdminUserUpdatePayload = Partial<AdminUserStorePayload & {
  status: AdminUserStatus;
}>;
