import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, tap } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { ToastService } from '../../../../core/services/toast.service';
import { createPagedList, type PagedQuery } from '../../../../shared/list/paged-list';
import { activeFilterCount, appliedValues, filterStrings } from '../../../../shared/list/filter-values';
import { NasCanDirective } from '../../../../shared/nas/nas-can/nas-can.directive';
import { NasConfirmService } from '../../../../shared/nas/nas-confirm-modal/nas-confirm.service';
import { NasFilterDialogComponent, type NasFilterField, type NasFilterValues } from '../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasListStateComponent, NasSkeletonRowComponent, SKELETON_ROWS, type NasSkeletonCell } from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { NasListToolbarComponent } from '../../../../shared/nas/nas-list-toolbar/nas-list-toolbar.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasRowMenuComponent, type NasRowAction, type NasRowActionPick } from '../../../../shared/nas/nas-row-menu/nas-row-menu.component';
import { NasStatusBadgeComponent, type NasStatusTone } from '../../../../shared/nas/nas-status-badge/nas-status-badge.component';
import { NasTableCardComponent } from '../../../../shared/nas/nas-table-card/nas-table-card.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import {
  ASSESSMENT_TYPES, CONTENT_LANGUAGES, type AiAssessmentRow, type AiUsage, type AssessmentStatus, type AssessmentType, type ContentLanguage,
} from '../../models/ai-assessment.model';
import { AiAssessmentsApiService } from '../../services/ai-assessments-api.service';
import { statusTone, typeTone } from '../../utils/ai-assessment-labels';

interface Query extends PagedQuery {
  readonly types: AssessmentType[];
  readonly languages: ContentLanguage[];
}

type RowAction = 'open' | 'duplicate' | 'version' | 'delete';



/**
 * The AI Assessment library (D-113): the trainer's own assessments (every
 * assessment for a super admin), searched and filtered on the server.
 */
@Component({
  selector: 'app-ai-assessment-list',
  standalone: true,
  imports: [
    RouterLink, TranslateModule, NasCanDirective, NasIconComponent, NasListToolbarComponent, NasTableCardComponent,
    NasListStateComponent, NasSkeletonRowComponent, NasPagerComponent, NasRowMenuComponent, NasStatusBadgeComponent,
    NasFilterDialogComponent, NasDatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-assessment-list.component.html',
  styleUrl: './ai-assessment-list.component.scss',
})
export class AiAssessmentListComponent implements OnInit {
  private readonly api = inject(AiAssessmentsApiService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(NasConfirmService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale = inject(LocaleService).locale;

  readonly skeletons = SKELETON_ROWS;
  readonly skeletonCells: readonly NasSkeletonCell[] = ['title', 'pill', 'short', 'num', 'text', 'pill', 'action'];

  readonly usage = signal<AiUsage | null>(null);
  readonly filterOpen = signal(false);
  readonly busyRow = signal<number | null>(null);
  private readonly langTick = signal(0);

  readonly canEdit = computed(() => this.auth.canDo('ai-assessments', 'edit'));
  readonly showAuthor = computed(() => this.auth.isSuperAdmin());

  readonly list = createPagedList<Query, AiAssessmentRow>({
    initial: { search: '', page: 1, perPage: 15, types: [], languages: [] },
    load: q => this.api.library({
      search: q.search, page: q.page, per_page: q.perPage,
      // One value each is a real filter; both chosen is the same as none.
      type: q.types.length === 1 ? q.types[0] : null,
      content_language: q.languages.length === 1 ? q.languages[0] : null,
    }).pipe(
      tap(page => this.usage.set(page.usage)),
      map(page => ({ items: page.rows, total: page.total })),
    ),
  });

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.list.query();
    return appliedValues({ types: q.types, languages: q.languages });
  });
  readonly activeFilters = computed(() => activeFilterCount(this.appliedFilters()));
  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.list.query().search !== '');

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    return [
      {
        key: 'types', multiple: true, label: this.t.instant('ai_assessments.filter_type'),
        placeholder: this.t.instant('ai_assessments.filter_type_placeholder'),
        options: ASSESSMENT_TYPES.map(id => ({ id, label: this.t.instant(`ai_assessments.types.${id}`) })),
      },
      {
        key: 'languages', multiple: true, label: this.t.instant('ai_assessments.filter_language'),
        placeholder: this.t.instant('ai_assessments.filter_language_placeholder'),
        options: CONTENT_LANGUAGES.map(id => ({ id, label: this.t.instant(`ai_assessments.languages.${id}`) })),
      },
    ];
  });

  readonly usageLeft = computed(() => {
    const u = this.usage();
    return u ? Math.max(0, u.limit - u.used) : null;
  });

  readonly rowActions = (row: AiAssessmentRow): readonly NasRowAction<RowAction>[] => {
    const actions: NasRowAction<RowAction>[] = [{ id: 'open', label: this.t.instant('ai_assessments.open'), icon: 'eye' }];
    if (this.auth.canDo('ai-assessments', 'create')) {
      actions.push({ id: 'duplicate', label: this.t.instant('ai_assessments.duplicate'), icon: 'copy' });
      actions.push({ id: 'version', label: this.t.instant('ai_assessments.new_version'), icon: 'arrows-clockwise' });
    }
    if (this.auth.canDo('ai-assessments', 'delete')) {
      actions.push({ id: 'delete', label: this.t.instant('common.delete'), icon: 'trash', danger: true });
    }
    void row;
    return actions;
  };

  constructor() {
    this.t.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.langTick.update(v => v + 1));
  }

  ngOnInit(): void {
    this.list.reload();
  }

  typeTone(type: AssessmentType): NasStatusTone {
    return typeTone(type);
  }

  statusTone(status: AssessmentStatus): NasStatusTone {
    return statusTone(status);
  }

  open(row: AiAssessmentRow): void {
    void this.router.navigate(['/admin/ai-assessments', row.id]);
  }

  onFilter(values: NasFilterValues): void {
    this.list.patch({
      types: filterStrings(values['types'], ASSESSMENT_TYPES),
      languages: filterStrings(values['languages'], CONTENT_LANGUAGES),
    });
  }

  async onRowAction(pick: NasRowActionPick<AiAssessmentRow, RowAction>): Promise<void> {
    const row = pick.row;
    switch (pick.id) {
      case 'open':
        this.open(row);
        return;
      case 'duplicate':
      case 'version':
        this.busyRow.set(row.id);
        this.api.duplicate(row.id, pick.id === 'version').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: copy => {
            this.busyRow.set(null);
            this.toast.success(pick.id === 'version' ? 'ai_assessments.toast_versioned' : 'ai_assessments.toast_duplicated');
            void this.router.navigate(['/admin/ai-assessments', copy.id]);
          },
          error: () => this.busyRow.set(null),
        });
        return;
      case 'delete': {
        const ok = await this.confirm.ask({
          title: this.t.instant('ai_assessments.delete_title'),
          message: this.t.instant('ai_assessments.delete_message', { title: row.title }),
        });
        if (!ok) return;
        this.busyRow.set(row.id);
        this.api.remove(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.busyRow.set(null);
            this.toast.success('ai_assessments.toast_deleted');
            // The last row of a later page: step back so the page is not empty.
            const q = this.list.query();
            if (this.list.items().length === 1 && q.page > 1) this.list.goTo(q.page - 1);
            else this.list.reload();
          },
          error: () => this.busyRow.set(null),
        });
      }
    }
  }
}
