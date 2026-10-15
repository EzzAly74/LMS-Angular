import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NasIconComponent } from '../../../../../../shared/nas';
import { NasPagerComponent } from '../../../../../../shared/nas/nas-pager/nas-pager.component';
import { ClientPager } from '../../../../../../shared/list/client-pager';

/**
 * Course Details - Qualifications tab (Figma 2266:130342): the qualifications
 * learners earn by completing the course, read-only (they are set in the
 * Add / Edit Course modal). They come with the course itself, so search and
 * paging are local.
 */
@Component({
  selector: 'app-course-qualifications-tab',
  standalone: true,
  imports: [FormsModule, TranslateModule, NasIconComponent, NasPagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-qualifications-tab.component.html',
  styleUrl: './course-qualifications-tab.component.scss',
})
export class CourseQualificationsTabComponent {
  readonly qualifications = input<Array<{ id: number; name: string }>>([]);

  readonly search = signal('');

  readonly filtered = computed(() => {
    const q = this.search().trim().toLocaleLowerCase();
    const all = this.qualifications();
    return q ? all.filter(x => (x.name ?? '').toLocaleLowerCase().includes(q)) : all;
  });

  /** Ten a page, as the other Course Details tabs. */
  readonly pager = new ClientPager(this.filtered, 10);

  onSearch(term: string): void {
    this.search.set(term);
    this.pager.reset();
  }
}
