import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import {
  NasStatCardComponent,
  NasTabsComponent,
  NasTab,
  NasStatusBadgeComponent,
  NasProgressComponent,
  NasAvatarComponent,
} from '../../../../shared/nas';
import { CoursesApiService } from '../../services/courses-api.service';
import type { CourseDetail, Cohort, CourseLearner, CourseReview } from '../../../../core/models/course.types';
import { mapApiCourseDetail, mapSessionToCohort, type ApiCourseRaw } from '../../../../core/utils/course-mapper';

export type { CourseDetail, Cohort, CourseLearner, CourseReview };

type DetailTab = 'overview' | 'cohort' | 'learners' | 'content' | 'qualifications' | 'ratings';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, ReactiveFormsModule, TranslateModule,
    DatePipe, DecimalPipe, TitleCasePipe,
    DialogModule, DropdownModule, CalendarModule, InputNumberModule, OverlayPanelModule,
    NasStatCardComponent, NasTabsComponent, NasStatusBadgeComponent, NasProgressComponent, NasAvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-detail.component.html',
  styleUrl: './course-detail.component.scss',
})
export class CourseDetailComponent implements OnInit {
  private readonly coursesApi = inject(CoursesApiService);
  private readonly fb         = inject(FormBuilder);
  private readonly route      = inject(ActivatedRoute);
  private readonly toast      = inject(MessageService);

  loading      = signal(true);
  course       = signal<CourseDetail | null>(null);
  courseId     = signal<number | null>(null);
  activeTab    = signal<DetailTab>('overview');
  activeCohort = signal<Cohort | null>(null);

  showCohort     = signal(false);
  cohortEditMode = signal(false);
  saving         = signal(false);

  sectionOptions = computed(() =>
    (this.course()?.sections ?? []).map(s => ({ id: s.id, name: s.name ?? `Section ${s.id}` })),
  );

  ratingDistributionRows = computed(() => {
    const d = this.course()?.rating_distribution ?? [0, 0, 0, 0, 0];
    const max = Math.max(...d, 1);
    return d.map((v, i) => ({ star: 5 - i, value: v, pct: (v / max) * 100 }));
  });

  ratingLabel = computed(() => {
    const c = this.course();
    return `Rating (${c?.rating_count ?? 0} reviews)`;
  });

  tabs = computed<NasTab[]>(() => {
    const c = this.course();
    return [
      { id: 'overview',       label: 'Overview' },
      { id: 'cohort',         label: 'Cohort',         count: c?.cohorts?.length ?? c?.cohorts_count ?? 0 },
      { id: 'learners',       label: 'Learners',       count: c?.learners?.length ?? c?.enrolled_count ?? 0 },
      { id: 'content',        label: 'Content' },
      { id: 'qualifications', label: 'Qualifications', count: c?.qualifications?.length ?? 0 },
      { id: 'ratings',        label: 'Ratings',        count: c?.rating_count ?? 0 },
    ];
  });

  cohortForm = this.fb.group({
    section_id: [null as number | null, Validators.required],
    name:       ['', Validators.required],
    capacity:   [30, [Validators.required, Validators.min(1)]],
    status:     ['scheduled', Validators.required],
    start_date: [null as Date | null],
    end_date:   [null as Date | null],
    location:   [''],
  });

  cohortStatusOpts = [
    { id: 'scheduled', name: 'Scheduled' },
    { id: 'active',    name: 'Active' },
    { id: 'completed', name: 'Completed' },
    { id: 'inactive',  name: 'Inactive' },
  ];

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) {
        this.courseId.set(id);
        this.load(id);
      }
    });
  }

  load(id: number): void {
    this.loading.set(true);
    forkJoin({
      course:   this.coursesApi.getById(id),
      sessions: this.coursesApi.listSessions(id, { per_page: 100 }),
    }).subscribe({
      next: ({ course, sessions }) => {
        const raw = course.result as unknown as ApiCourseRaw;
        const mapped = mapApiCourseDetail(raw);
        const cohorts = (sessions.result?.data ?? []).map(mapSessionToCohort);
        this.course.set({
          ...mapped,
          cohorts,
          cohorts_count: cohorts.length,
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setTab(t: string): void { this.activeTab.set(t as DetailTab); }

  openAddCohort(): void {
    const sections = this.sectionOptions();
    this.cohortEditMode.set(false);
    this.activeCohort.set(null);
    this.cohortForm.reset({
      section_id: sections[0]?.id ?? null,
      name: '', capacity: 30, status: 'scheduled',
      start_date: null, end_date: null, location: '',
    });
    this.showCohort.set(true);
  }

  openEditCohort(cohort: Cohort, overlay: OverlayPanel): void {
    overlay.hide();
    this.cohortEditMode.set(true);
    this.activeCohort.set(cohort);
    this.cohortForm.reset({
      section_id: cohort.section_id ?? this.sectionOptions()[0]?.id ?? null,
      name:       cohort.name,
      capacity:   cohort.capacity,
      status:     cohort.status,
      start_date: cohort.start_date ? new Date(cohort.start_date) : null,
      end_date:   cohort.end_date   ? new Date(cohort.end_date)   : null,
      location:   '',
    });
    this.showCohort.set(true);
  }

  submitCohort(): void {
    if (this.cohortForm.invalid) { this.cohortForm.markAllAsTouched(); return; }
    const id = this.courseId();
    if (!id) return;

    this.saving.set(true);
    const v = this.cohortForm.getRawValue();
    const body = {
      section_id:   v.section_id!,
      title:        v.name!,
      session_date: v.start_date ? this.toIso(v.start_date) : null,
      time_from:    null,
      time_to:      null,
      location:     v.location || null,
    };

    const req = this.cohortEditMode() && this.activeCohort()
      ? this.coursesApi.updateSession(id, this.activeCohort()!.id, body)
      : this.coursesApi.createSession(id, body);

    req.subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          detail: this.cohortEditMode() ? 'Cohort updated' : 'Cohort created',
        });
        this.saving.set(false);
        this.showCohort.set(false);
        this.load(id);
      },
      error: () => this.saving.set(false),
    });
  }

  deleteCohort(cohort: Cohort, overlay: OverlayPanel): void {
    overlay.hide();
    const id = this.courseId();
    if (!id) return;
    this.coursesApi.deleteSession(id, cohort.id).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', detail: 'Cohort deleted' });
        this.load(id);
      },
    });
  }

  openCohortMenu(ev: Event, cohort: Cohort, overlay: OverlayPanel): void {
    this.activeCohort.set(cohort);
    overlay.toggle(ev);
  }

  private toIso(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
  }

  statusTone(s: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
    switch (s) {
      case 'completed':
      case 'active':       return 'success';
      case 'pending':
      case 'in_progress':  return 'warning';
      case 'upcoming':     return 'info';
      case 'inactive':
      case 'not_started':  return 'danger';
      default:             return 'neutral';
    }
  }

  typeTone(s?: string): 'teal' | 'neutral' | 'success' | 'sky' {
    return s === 'hybrid' ? 'success'
         : s === 'online' ? 'teal'
         : s === 'external_link' ? 'sky'
         : 'neutral';
  }

  cohortStatusLabel(s: Cohort['status']): string {
    switch (s) {
      case 'completed': return 'Completed';
      case 'active':    return 'Active';
      case 'upcoming':  return 'Up Coming';
      case 'inactive':  return 'Inactive';
    }
  }
}
