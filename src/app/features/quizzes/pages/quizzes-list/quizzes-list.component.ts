import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { API } from '../../../../core/constants/api.constants';
import { ApiService } from '../../../../core/services/api.service';
import { AssessmentListComponent } from '../../../../shared/assessment-list/assessment-list.component';
import type { AssessmentListSource, IdName } from '../../../../shared/assessment-list/assessment-list.source';
import { QUIZ_TYPES } from '../../models/quiz.types';
import { QuizzesApiService } from '../../services/quizzes-api.service';

/**
 * Quizzes landing (Figma 1983:42584): the shared Quizzes / Assignments list,
 * configured with the quiz API and keys.
 */
@Component({
  selector: 'app-quizzes-list',
  standalone: true,
  imports: [AssessmentListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-assessment-list [source]="source" />`,
})
export class QuizzesListComponent {
  private readonly quizzes = inject(QuizzesApiService);
  private readonly api = inject(ApiService);

  protected readonly source: AssessmentListSource = {
    kind: 'quiz',
    ns: 'quizzes',
    toastNs: 'quizzes_list_toasts',
    keys: {
      subtitle: 'quizzes.subtitle',
      allCreated: 'quizzes.all_created',
      colItems: 'quizzes.col_quizzes',
      colItem: 'quizzes.col_quiz',
      viewItem: 'quizzes.view_quiz',
    },
    route: '/admin/quizzes',
    types: QUIZ_TYPES,
    summary: () => this.quizzes.summary().pipe(map(r => ({ items: r.result.quizzes_count, courses: r.result.courses_count }))),
    items: params => this.quizzes.list(params),
    options: search => this.quizzes.listMinimal(search).pipe(map(r => r.result ?? [])),
    remove: id => this.quizzes.delete(id),
    attempts: params => this.quizzes.listSubmissions(params).pipe(map(res => ({
      ...res,
      result: {
        ...res.result,
        data: res.result.data.map(s => ({ ...s, item_title: s.quiz_title, item_type: s.quiz_type })),
      },
    }))),
    instructors: () => this.quizzes.instructors().pipe(map(r => r.result ?? [])),
    learners: () => this.api
      .get<{ learners: IdName[] }>(`${API.ADMIN_QUIZZES}/submissions/filter-options`)
      .pipe(map(r => r.result?.learners ?? [])),
  };
}
