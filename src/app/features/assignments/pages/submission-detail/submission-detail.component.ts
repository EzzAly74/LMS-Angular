import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NasStatusBadgeComponent, NasStatusTone } from '../../../../shared/nas';
import { NasFileCardComponent } from '../../../../shared/nas/nas-file-card/nas-file-card.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { LocaleService } from '../../../../core/services/locale.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { AssignmentsApiService } from '../../services/assignments-api.service';
import {
  MANUAL_QUESTION_TYPES,
  type AssignmentQuestion,
  type AssignmentQuestionType,
  type SubmissionAnswer,
  type SubmissionDetail,
} from '../../models/assignment.types';

interface QuestionRow {
  answer: SubmissionAnswer;
  position: number;
}

/**
 * Assignment submission review - Figma 2393:120281 (not yet scored),
 * 2393:121481 (scored, Edit) and 2393:121817 (editing, Update Score).
 *
 * Header, three stat cards, then one card per question. File questions
 * (D-033 / D-064) show the learner's upload and the assignment's own file;
 * questions a person scores (open, file) carry the Score form. The other
 * types keep their read-only review.
 */
@Component({
  selector: 'app-submission-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    SkeletonModule,
    TranslateModule,
    NasStatusBadgeComponent,
    NasFileCardComponent,
    NasDatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './submission-detail.component.html',
  styleUrl:    './submission-detail.component.scss',
})
export class SubmissionDetailComponent implements OnInit {
  private readonly api        = inject(AssignmentsApiService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly toast      = inject(MessageService);
  private readonly t          = inject(TranslateService);
  private readonly enums      = inject(EnumsService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale   = inject(LocaleService).locale;

  readonly loading = signal(true);
  readonly failed  = signal(false);
  readonly detail  = signal<SubmissionDetail | null>(null);

  /** Scored answers reopened with Edit (2393:121817). */
  readonly editing  = signal<ReadonlySet<number>>(new Set());
  /** Score / feedback typed but not saved, per answer. */
  readonly drafts   = signal<Readonly<Record<number, string>>>({});
  readonly feedback = signal<Readonly<Record<number, string>>>({});
  readonly saving   = signal<number | null>(null);
  readonly downloading = signal<string | null>(null);

  readonly questionRows = computed<QuestionRow[]>(() =>
    (this.detail()?.answers ?? [])
      .filter((a): a is SubmissionAnswer => !!a)
      .sort((a, b) => (a.question?.position ?? 0) - (b.question?.position ?? 0))
      .map((a, i) => ({ answer: a, position: i + 1 })),
  );

  readonly title = computed(() => {
    const a = this.detail()?.assignment;
    if (!a) return this.t.instant('assignments.submission');
    return this.locale() === 'ar' ? (a.title_ar || a.title) : (a.title || a.title_ar || '');
  });

  /** Taken once, outside any computed, as EnumsService documents. */
  private readonly courseTypes = this.enums.options('course_type');

  readonly typeLabel = computed(() => {
    const code = this.detail()?.course_type;
    return code ? (this.courseTypes().find(o => o.code === code)?.value ?? code) : '';
  });

  /** "--" until every answer is scored (Figma draws "--%" and "-- / 20"). */
  readonly scored = computed(() => {
    const d = this.detail();
    return !!d && d.total_score !== null && d.pending_answers === 0;
  });

  private submissionId = 0;

  constructor() {
    // Question text, titles and names come back localised: refetch on a switch.
    withLocaleReload(() => { if (this.submissionId) this.load(); });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.router.navigate(['/admin/assignments']);
      return;
    }
    this.submissionId = id;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.getSubmission(this.submissionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.detail.set(res.result);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  /* ── Scoring (open + file questions) ─────────────────────────── */

  isManual(type: AssignmentQuestionType | undefined): boolean {
    return !!type && MANUAL_QUESTION_TYPES.includes(type);
  }

  /** The form shows until the answer is scored, and again after Edit. */
  showForm(a: SubmissionAnswer): boolean {
    return a.awarded_score === null || this.editing().has(a.id);
  }

  draft(a: SubmissionAnswer): string {
    return this.drafts()[a.id] ?? '';
  }

  setDraft(a: SubmissionAnswer, value: string | number | null): void {
    this.drafts.update(d => ({ ...d, [a.id]: value === null ? '' : String(value) }));
  }

  feedbackDraft(a: SubmissionAnswer): string {
    return this.feedback()[a.id] ?? a.feedback ?? '';
  }

  setFeedback(a: SubmissionAnswer, value: string): void {
    this.feedback.update(f => ({ ...f, [a.id]: value }));
  }

  /** A whole number from 0 to the question's points; null otherwise. */
  parsedScore(a: SubmissionAnswer): number | null {
    const raw = this.draft(a).trim();
    if (!/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    return n <= (a.question?.score ?? 0) ? n : null;
  }

  scoreInvalid(a: SubmissionAnswer): boolean {
    return this.draft(a).trim() !== '' && this.parsedScore(a) === null;
  }

  startEdit(a: SubmissionAnswer): void {
    this.setDraft(a, a.awarded_score);
    this.setFeedback(a, a.feedback ?? '');
    this.editing.update(s => new Set(s).add(a.id));
  }

  cancel(a: SubmissionAnswer): void {
    this.drafts.update(d => { const n = { ...d }; delete n[a.id]; return n; });
    this.editing.update(s => { const n = new Set(s); n.delete(a.id); return n; });
  }

  save(a: SubmissionAnswer): void {
    const score = this.parsedScore(a);
    const d = this.detail();
    if (score === null || !d || this.saving() !== null) return;

    this.saving.set(a.id);
    const fb = a.question?.type === 'open' ? this.feedbackDraft(a) : (a.feedback ?? '');
    this.api.gradeAnswer(d.id, a.id, { awarded_score: score, feedback: fb.trim() || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.detail.set(res.result.submission);
          this.cancel(a);
          this.saving.set(null);
          this.toast.add({ severity: 'success', detail: this.t.instant('submission_score_updated') });
        },
        error: () => this.saving.set(null),
      });
  }

  /* ── Files ───────────────────────────────────────────────────── */

  downloadAnswer(a: SubmissionAnswer): void {
    const d = this.detail();
    if (!d || !a.file) return;
    this.download(`a${a.id}`, this.api.downloadAnswerFile(d.id, a.id, a.file.name ?? 'answer'));
  }

  downloadAttachment(q: AssignmentQuestion): void {
    const d = this.detail();
    if (!d?.assignment || !q.id || !q.attachment) return;
    this.download(`q${q.id}`, this.api.downloadAttachment(d.assignment.id, q.id, q.attachment.name ?? 'attachment'));
  }

  private download(key: string, request: ReturnType<AssignmentsApiService['downloadAnswerFile']>): void {
    if (this.downloading()) return;
    this.downloading.set(key);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.downloading.set(null),
      error: () => {
        this.downloading.set(null);
        this.toast.add({ severity: 'error', detail: this.t.instant('assignments.download_failed') });
      },
    });
  }

  /* ── Localised text ──────────────────────────────────────────── */

  questionText(q: AssignmentQuestion | null): string {
    if (!q) return '';
    return this.locale() === 'ar' ? (q.question_ar || q.question_en) : (q.question_en || q.question_ar || '');
  }

  questionTypeLabel(type: AssignmentQuestionType | undefined): string {
    return type ? this.t.instant(`quiz_types.${type}`) : '';
  }

  statusTone(): NasStatusTone {
    return this.detail()?.assignment?.status === 'active' ? 'success' : 'neutral';
  }

  typeTone(s: string | null | undefined): NasStatusTone {
    return s === 'hybrid' ? 'success' : s === 'online' ? 'teal' : s === 'external_link' ? 'sky' : 'neutral';
  }

  /* ── Read-only review of the auto-graded types ──────────────── */

  isCorrectOption(answer: SubmissionAnswer, optionLabel: string): boolean {
    const correct = answer.question?.correct_answer_en?.trim().toLowerCase();
    return !!correct && optionLabel.trim().toLowerCase() === correct;
  }

  isLearnerOption(answer: SubmissionAnswer, optionLabel: string): boolean {
    const raw = answer.answer;
    if (!raw || !('value' in raw)) return false;
    return raw.value?.trim().toLowerCase() === optionLabel.trim().toLowerCase();
  }

  learnerOrder(answer: SubmissionAnswer): string[] {
    const raw = answer.answer;
    if (!raw || !('order' in raw) || !Array.isArray(raw.order)) return [];
    return raw.order;
  }

  correctOrder(answer: SubmissionAnswer): string[] {
    const raw = answer.question?.correct_answer_en ?? '';
    if (!raw.trim()) return answer.question?.options_en ?? [];
    return raw.split(/[,|]/).map(s => s.trim()).filter(Boolean);
  }

  openAnswerText(answer: SubmissionAnswer): string {
    const raw = answer.answer;
    if (!raw || !('value' in raw)) return '';
    return raw.value ?? '';
  }

  yesNoLearner(answer: SubmissionAnswer): 'yes' | 'no' | null {
    const raw = answer.answer;
    if (!raw || !('value' in raw)) return null;
    const v = raw.value?.toLowerCase();
    return v === 'yes' || v === 'no' ? v : null;
  }

  isYesNoCorrect(answer: SubmissionAnswer, value: 'yes' | 'no'): boolean {
    return (answer.question?.correct_answer_en ?? '').toLowerCase() === value;
  }

  back(): void {
    this.router.navigate(['/admin/assignments']);
  }
}
