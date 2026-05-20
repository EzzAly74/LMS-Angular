import {
  ChangeDetectionStrategy, Component, OnInit, ViewChild,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import {
  NasPageHeaderComponent,
  NasPillTabsComponent,
  NasPillTab,
  NasStatusBadgeComponent,
  NasProgressComponent,
  NasLocaleInputComponent,
} from '../../../../shared/nas';
import { CoursesApiService } from '../../services/courses-api.service';
import type { LocalizedText } from '../../../../core/models/localized.types';
import { mapApiCourseListItem, type ApiCourseRaw } from '../../../../core/utils/course-mapper';

import type { Course, CourseStatus, CourseType } from '../../../../core/models/course.types';

type ActiveTab = 'all' | 'pending' | 'active' | 'upcoming' | 'inactive';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, ReactiveFormsModule, DatePipe, TranslateModule,
    OverlayPanelModule, ConfirmDialogModule, DialogModule,
    DropdownModule, CalendarModule, InputNumberModule, CheckboxModule,
    NasPageHeaderComponent, NasPillTabsComponent, NasStatusBadgeComponent, NasProgressComponent,
    NasLocaleInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-list.component.html',
  styleUrl: './course-list.component.scss',
})
export class CourseListComponent implements OnInit {
  @ViewChild('rowMenu') rowMenu!: OverlayPanel;

  private api            = inject(ApiService);
  private coursesApi     = inject(CoursesApiService);
  private fb             = inject(FormBuilder);
  private router         = inject(Router);
  private confirmService = inject(ConfirmationService);
  private toast          = inject(MessageService);

  items     = signal<Course[]>([]);
  total     = signal(0);
  loading   = signal(true);
  activeTab = signal<ActiveTab>('all');
  tabCounts = signal<Partial<Record<ActiveTab, number>>>({});

  activeRow = signal<Course | null>(null);

  /* Add Course modal */
  showAddCourse = signal(false);
  qualOptions   = signal<Array<{ id: number; name: string }>>([]);
  catOptions    = signal<Array<{ id: number; name: string }>>([]);
  instOptions   = signal<Array<{ id: number; name: string }>>([]);
  saving        = signal(false);

  /* Search */
  perPage = 15;
  page    = 1;
  search  = '';
  private search$ = new Subject<string>();

  /* Type select */
  typeOpts = [
    { id: 'online',        name: 'Online' },
    { id: 'offline',       name: 'Offline' },
    { id: 'hybrid',        name: 'Hybrid' },
    { id: 'external_link', name: 'External Link' },
  ];

  tabs = computed<NasPillTab[]>(() => [
    { id: 'all',      label: 'All',      count: this.total() ?? null },
    { id: 'pending',  label: 'Pending',  count: this.tabCounts()['pending'] ?? null },
    { id: 'active',   label: 'Active',   count: this.tabCounts()['active'] ?? null },
    { id: 'upcoming', label: 'Up coming',count: this.tabCounts()['upcoming'] ?? null },
    { id: 'inactive', label: 'Inactive', count: this.tabCounts()['inactive'] ?? null },
  ]);

  form = this.fb.group({
    title:               this.fb.control<LocalizedText>({ en: '', ar: '' }, Validators.required),
    type:                ['hybrid', Validators.required],
    category_id:         [null as number | null, Validators.required],
    instructor_id:       [null as number | null, Validators.required],
    certificate:         [true,  Validators.required],
    require_instructor:  [true,  Validators.required],
    description:         this.fb.control<LocalizedText>({ en: '', ar: '' }, Validators.required),
    hours:               [1, [Validators.required, Validators.min(1)]],
    max_learners:        [30,    [Validators.required, Validators.min(1)]],
    cohort_start:        [null as Date | null],
    cohort_end:          [null as Date | null],
    qualification_ids:   [[] as number[]],
    image:               [null as File | null],
  });

  ngOnInit(): void {
    this.search$.pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(q => { this.search = q; this.page = 1; this.load(); });

    this.load();
    this.loadTabCounts();
    this.loadSelectOptions();
  }

  /* ── Data ─────────────────────────────────────────────────────────── */
  load(): void {
    this.loading.set(true);
    const params: Record<string, string | number | boolean> = { page: this.page, per_page: this.perPage };
    if (this.search) params['search'] = this.search;
    if (this.activeTab() !== 'all') params['status'] = this.activeTab();

    this.api.getPaginated<Course>(API.COURSES, params).subscribe({
      next:  res => {
        this.items.set(res.result.data.map(c => mapApiCourseListItem(c as unknown as ApiCourseRaw)));
        this.total.set(res.result.total);
        this.loading.set(false);
      },
      error: ()  => this.loading.set(false),
    });
  }

  loadTabCounts(): void {
    const statuses: Exclude<ActiveTab, 'all'>[] = ['pending', 'active', 'upcoming', 'inactive'];
    const reqs = statuses.map(s =>
      this.api.getPaginated<Course>(API.COURSES, { per_page: 1, page: 1, status: s })
    );
    forkJoin(reqs).subscribe({
      next: results => {
        const counts: Partial<Record<ActiveTab, number>> = {};
        statuses.forEach((s, i) => { counts[s] = results[i].result.total; });
        this.tabCounts.set(counts);
      },
    });
  }

  loadSelectOptions(): void {
    this.api.get<Array<{ id: number; name: string }>>(API.CATEGORIES_ACTIVE).subscribe({
      next: r => this.catOptions.set(Array.isArray(r.result) ? r.result : []),
    });
    this.api.get<Array<{ id: number; name: string }>>(API.INSTRUCTORS_ALL).subscribe({
      next: r => this.instOptions.set(Array.isArray(r.result) ? r.result : []),
    });
    this.api.get<Array<{ id: number; name: string }>>(API.QUALIFICATIONS_ACTIVE).subscribe({
      next: r => this.qualOptions.set(Array.isArray(r.result) ? r.result : []),
    });
  }

  /* ── Tabs / search / paging ───────────────────────────────────────── */
  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.page = 1;
    this.load();
  }

  onSearch(e: Event): void {
    this.search$.next((e.target as HTMLInputElement).value);
  }

  /* ── Row menu ─────────────────────────────────────────────────────── */
  openRowMenu(ev: Event, course: Course): void {
    this.activeRow.set(course);
    this.rowMenu.toggle(ev);
  }

  goToDetail(course: Course): void {
    this.router.navigate(['/admin/courses', course.id]);
    this.rowMenu.hide();
  }

  editCourse(course: Course): void {
    this.toast.add({ severity: 'info', summary: 'Edit', detail: course.title });
    this.rowMenu.hide();
  }

  /* ── Add Course modal ─────────────────────────────────────────────── */
  openAddCourse(): void {
    this.form.reset({
      title: { en: '', ar: '' }, type: 'hybrid', category_id: null, instructor_id: null,
      certificate: true, require_instructor: true, description: { en: '', ar: '' },
      hours: 1, max_learners: 30, cohort_start: null, cohort_end: null, qualification_ids: [], image: null,
    });
    this.showAddCourse.set(true);
  }

  submitAddCourse(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const fd = new FormData();
    const title = v.title as LocalizedText;
    const desc  = v.description as LocalizedText;
    fd.append('title[en]', title.en);
    fd.append('title[ar]', title.ar || title.en);
    fd.append('description[en]', desc.en);
    fd.append('description[ar]', desc.ar || desc.en);
    fd.append('course_type', v.type === 'online' ? 'online' : 'offline');
    fd.append('category_id', String(v.category_id!));
    fd.append('hours', String(v.hours ?? 1));
    fd.append('certificate', v.certificate ? '1' : '0');
    fd.append('instructors[]', String(v.instructor_id!));
    (v.qualification_ids ?? []).forEach((id: number) => fd.append('qualification_skill_ids[]', String(id)));
    if (v.image) fd.append('image', v.image);
    this.coursesApi.create(fd).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', detail: 'Course created' });
        this.showAddCourse.set(false);
        this.saving.set(false);
        this.load();
        this.loadTabCounts();
      },
      error: () => this.saving.set(false),
    });
  }

  private toIso(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
  }

  /* ── Helpers ──────────────────────────────────────────────────────── */
  statusTone(status: CourseStatus | undefined): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
    switch (status) {
      case 'active':   return 'success';
      case 'pending':  return 'warning';
      case 'upcoming': return 'info';
      case 'inactive': return 'danger';
      default:         return 'neutral';
    }
  }

  typeTone(type: CourseType | undefined): 'teal' | 'neutral' | 'success' | 'sky' {
    switch (type) {
      case 'online':        return 'teal';
      case 'offline':       return 'neutral';
      case 'hybrid':        return 'success';
      case 'external_link': return 'sky';
      default:              return 'neutral';
    }
  }

  typeLabel(type: CourseType | undefined): string {
    if (!type) return '';
    return type === 'external_link' ? 'External Link' : type.charAt(0).toUpperCase() + type.slice(1);
  }
}
