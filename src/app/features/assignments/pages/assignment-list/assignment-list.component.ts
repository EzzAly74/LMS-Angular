import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { API } from '../../../../core/constants/api.constants';
import { ApiService } from '../../../../core/services/api.service';
import { AssessmentListComponent } from '../../../../shared/assessment-list/assessment-list.component';
import type { AssessmentListSource, IdName } from '../../../../shared/assessment-list/assessment-list.source';
import { ASSIGNMENT_TYPES } from '../../models/assignment.types';
import { AssignmentsApiService } from '../../services/assignments-api.service';

/**
 * Assignments list: the Quizzes landing frame (Figma 1983:42584; no own
 * frame, Q-046), i.e. the shared Quizzes / Assignments list configured with
 * the assignment API and keys.
 */
@Component({
  selector: 'app-assignment-list',
  standalone: true,
  imports: [AssessmentListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-assessment-list [source]="source" />`,
})
export class AssignmentListComponent {
  private readonly assignments = inject(AssignmentsApiService);
  private readonly api = inject(ApiService);

  protected readonly source: AssessmentListSource = {
    kind: 'assignment',
    ns: 'assignments',
    toastNs: 'assignments_list_toasts',
    keys: {
      subtitle: 'assignments.subtitle_attempts',
      allCreated: 'assignments.all_assignments',
      colItems: 'assignments.col_assignments',
      colItem: 'assignments.col_assignment',
      viewItem: 'assignments.view_assignment',
    },
    route: '/admin/assignments',
    types: ASSIGNMENT_TYPES,
    summary: () => this.assignments.summary().pipe(map(r => ({ items: r.result.assignments_count, courses: r.result.courses_count }))),
    items: params => this.assignments.list(params),
    options: search => this.assignments.listMinimal(search).pipe(map(r => r.result ?? [])),
    remove: id => this.assignments.delete(id),
    attempts: params => this.assignments.listSubmissions(params).pipe(map(res => ({
      ...res,
      result: {
        ...res.result,
        data: res.result.data.map(s => ({ ...s, item_title: s.assignment_title, item_type: s.assignment_type })),
      },
    }))),
    filterOptions: () => this.api
      .get<{ learners: IdName[]; instructors: IdName[] }>(`${API.ADMIN_ASSIGNMENTS}/submissions/filter-options`)
      .pipe(map(r => ({ learners: r.result?.learners ?? [], instructors: r.result?.instructors ?? [] }))),
  };
}
