/**
 * Type definitions for the Admin Ratings overview.
 *
 * Mirrors the response shapes produced by the new Laravel API endpoints
 * under `/api/v1/admin/ratings/*`.
 */

export interface RatingUser {
  id: number;
  name: string;
  machine_code?: string | null;
}

export interface RatingCourse {
  id: number;
  title: string;
}

export interface RatingInstructor {
  id: number;
  name: string;
}

export interface RatingListItem {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string | null;
  user: RatingUser | null;
  course: RatingCourse | null;
  instructor: RatingInstructor | null;
  instructors: RatingInstructor[];
}

export interface RatingSummary {
  total_ratings: number;
  average_score: number;
  five_star_count: number;
  low_count: number;
}

export interface RatingLearnerOption {
  id: number;
  name: string | null;
  machine_code: string | null;
}

export interface RatingInstructorOption {
  id: number;
  name: string | null;
}

export interface RatingCourseOption {
  id: number;
  title: string | null;
}

export interface RatingFilterOptions {
  instructors: RatingInstructorOption[];
  learners:    RatingLearnerOption[];
  courses:     RatingCourseOption[];
}
