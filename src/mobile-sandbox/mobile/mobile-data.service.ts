import { Injectable, inject } from '@angular/core';
import { MobileApiService, ApiCallResult, CallInputs } from '../core/mobile-api.service';
import { endpointById } from '../core/endpoints';
import {
  ActiveCourse,
  AttendanceSession,
  CategoryChip,
  CertificateCard,
  CourseCard,
  CourseDetail,
  MyLearningOverview,
  QualificationProgress,
  ScopeChip,
} from './mobile.models';

/** Inner data + the raw call result (for the inspector / logs). */
export interface DataResult<T> {
  data: T;
  call: ApiCallResult;
}

/**
 * Thin typed facade over {@link MobileApiService} for the Figma preview
 * screens. Every method targets one entry in the endpoint catalog, runs
 * it through the isolated HTTP client (shared token + employee code), and
 * unwraps the `{ status, message, result }` envelope into a typed shape.
 *
 * The raw {@link ApiCallResult} rides along so the preview can pipe it
 * into the result inspector and the shared log.
 */
@Injectable({ providedIn: 'root' })
export class MobileDataService {
  private readonly api = inject(MobileApiService);

  private async run<T>(id: string, inputs: CallInputs = {}): Promise<DataResult<T>> {
    const def = endpointById(id);
    if (!def) throw new Error(`Unknown endpoint: ${id}`);
    const call = await this.api.call(def, inputs);
    return { data: this.unwrap<T>(call), call };
  }

  /** Pull the payload out of the API envelope: `result` (or the body itself). */
  private unwrap<T>(call: ApiCallResult): T {
    const body = call.response as { result?: unknown } | null;
    if (body && typeof body === 'object' && 'result' in body) {
      return (body as { result: T }).result;
    }
    return body as unknown as T;
  }

  categories(): Promise<DataResult<CategoryChip[]>> {
    return this.run<CategoryChip[]>('academy_categories');
  }

  scopes(): Promise<DataResult<ScopeChip[]>> {
    return this.run<ScopeChip[]>('academy_scopes');
  }

  courses(inputs: CallInputs = {}): Promise<DataResult<CourseCard[]>> {
    return this.run<CourseCard[]>('academy_courses', inputs);
  }

  courseDetail(courseId: number): Promise<DataResult<CourseDetail>> {
    return this.run<CourseDetail>('academy_course_detail', { course: courseId });
  }

  enrol(courseId: number, cohortId?: number | null): Promise<DataResult<unknown>> {
    return this.run<unknown>('academy_enrol', { course: courseId, cohort_id: cohortId ?? undefined });
  }

  myOverview(): Promise<DataResult<MyLearningOverview>> {
    return this.run<MyLearningOverview>('my_overview');
  }

  activeCourses(): Promise<DataResult<ActiveCourse[]>> {
    return this.run<ActiveCourse[]>('my_active');
  }

  qualifications(): Promise<DataResult<QualificationProgress[]>> {
    return this.run<QualificationProgress[]>('my_qualifications');
  }

  certificates(): Promise<DataResult<CertificateCard[]>> {
    return this.run<CertificateCard[]>('my_certificates');
  }

  sessions(courseId: number): Promise<DataResult<AttendanceSession[]>> {
    return this.run<AttendanceSession[]>('my_sessions', { course: courseId });
  }

  markAttendance(body: { course_id: number; session_id?: number; passcode: string }): Promise<DataResult<unknown>> {
    return this.run<unknown>('attendance_mark', body);
  }

  rate(courseId: number, body: { rating: number; comment?: string }): Promise<DataResult<unknown>> {
    return this.run<unknown>('my_rating', { course: courseId, ...body });
  }
}
