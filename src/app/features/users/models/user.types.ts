/**
 * Shape contracts for the 2026 admin Users redesign.
 *
 * Mirrors the Laravel resources at
 *   App\Http\Resources\Admin\AdminUserListResource
 *   App\Http\Resources\Admin\AdminUserDetailResource
 * served by routes/apis/admin-users.php.
 */

/**
 * Bucketed system roles that route to a dedicated person table.
 * The dropdown itself is dynamic (sourced from the `roles` table) so a
 * persisted user may carry a custom role key outside this enum — that's
 * why we widen the contract with `(string & {})` below.
 */
export type AdminUserRole   = 'admin' | 'instructor' | 'learner';
/** Any machine-name returned by the dynamic `/admin/users/filter-options` endpoint. */
export type AdminUserRoleKey = AdminUserRole | (string & {});
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
  /**
   * Fully-qualified avatar URL (resolved server-side via `HasFile`)
   * or `null` when the row has no image. Replaces the legacy
   * single-letter "initial" placeholder on the avatar circle.
   */
  image: string | null;
  role: string;
  role_key: AdminUserRoleKey;
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
  /** Machine name from the `roles` table (admin guard). */
  key:   AdminUserRoleKey;
  /** Bilingual display label resolved server-side via `Accept-Language`. */
  label: string;
  /** Live count of people attached to the role (bucketed or pivoted). */
  count: number;
}

export interface AdminUserFilterOptions {
  roles:       AdminUserRoleOption[];
  instructors: Array<{ id: number; name: string; email: string | null }>;
}

export interface AdminUserStorePayload {
  name_en: string;
  name_ar: string;
  email: string;
  role: AdminUserRoleKey;
  department_name?: string | null;
  phone?: string | null;
  learner_type?: LearnerType | null;
  /** Optional avatar upload. Sent as multipart/form-data when present. */
  image?: File | null;
}

export type AdminUserUpdatePayload = Partial<AdminUserStorePayload & {
  status: AdminUserStatus;
}>;
