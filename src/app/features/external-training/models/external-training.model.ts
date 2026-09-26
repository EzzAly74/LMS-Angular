/** External Training review (D8) - the shapes of admin/external-training (D-057). */

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export const REQUEST_STATUSES: readonly RequestStatus[] = ['pending', 'approved', 'rejected'];

export interface RequestRef {
  id: number;
  name: string;
}

export interface ExternalTrainingRequest {
  id: number;
  title: string;
  provider: string;
  start_date: string;
  end_date: string;
  hours: number;
  cost: number | null;
  currency: string;
  status: RequestStatus;
  rejection_reason: string | null;
  qualification: RequestRef | null;
  course: { id: number; title: string } | null;
  certificate: { name: string; mime: string; size: number };
  submitted_at: string | null;
  decided_at: string | null;
  learner: { id: number; name: string; employee_id: string | null } | null;
  decided_by: RequestRef | null;
}

export interface RequestStats {
  pending: number;
  this_year: number;
  rejected_this_year: number;
  year: number;
}

export interface ReviewOptions {
  qualifications: RequestRef[];
  courses: { id: number; title: string }[];
}

/** Server limit, mirrored for UX only (AdminExternalTrainingRejectRequest). */
export const REASON_MAX = 1000;
