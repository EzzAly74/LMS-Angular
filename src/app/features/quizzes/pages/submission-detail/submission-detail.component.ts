import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  NasStatusBadgeComponent,
} from '../../../../shared/nas';
import { QuizzesApiService } from '../../services/quizzes-api.service';
import type {
  QuizQuestionType,
  QuizSubmissionAnswer,
  QuizSubmissionDetail,
} from '../../models/quiz.types';

interface QuestionRow {
  answer: QuizSubmissionAnswer;
  position: number;
}

@Component({
  selector: 'app-quiz-submission-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SkeletonModule,
    ToastModule,
    NasStatusBadgeComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './submission-detail.component.html',
  styleUrl:    './submission-detail.component.scss',
})
export class SubmissionDetailComponent implements OnInit, OnDestroy {
  private readonly api      = inject(QuizzesApiService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly toast    = inject(MessageService);
  private readonly destroy$ = new Subject<void>();

  readonly loading         = signal(true);
  readonly detail          = signal<QuizSubmissionDetail | null>(null);
  readonly editingAnswerId = signal<number | null>(null);
  readonly editingScore    = signal<number>(0);
  readonly editingFeedback = signal<string>('');
  readonly savingAnswerId  = signal<number | null>(null);

  readonly questionRows = computed<QuestionRow[]>(() => {
    const list = this.detail()?.answers ?? [];
    return list
      .filter((a): a is QuizSubmissionAnswer => !!a)
      .sort((a, b) => (a.question?.position ?? 0) - (b.question?.position ?? 0))
      .map((a, i) => ({ answer: a, position: i + 1 }));
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.router.navigate(['/admin/quizzes']);
      return;
    }
    this.load(id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Loaders ─────────────────────────────────────────────────── */

  private load(id: number): void {
    this.loading.set(true);
    this.api.getSubmission(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.detail.set(res.result);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.router.navigate(['/admin/quizzes']);
        },
      });
  }

  /* ── Inline grading (open questions) ─────────────────────────── */

  startEdit(answer: QuizSubmissionAnswer): void {
    if (answer.question?.type !== 'open') return;
    this.editingAnswerId.set(answer.id);
    this.editingScore.set(answer.awarded_score ?? 0);
    this.editingFeedback.set(answer.feedback ?? '');
  }

  cancelEdit(): void {
    this.editingAnswerId.set(null);
  }

  saveEdit(answer: QuizSubmissionAnswer): void {
    const submission = this.detail();
    if (!submission || !answer) return;

    const max = answer.question?.score ?? 0;
    const raw = Number(this.editingScore());
    const safe = Math.max(0, Math.min(Number.isFinite(raw) ? raw : 0, max));

    this.savingAnswerId.set(answer.id);
    this.api.gradeAnswer(submission.id, answer.id, {
      awarded_score: safe,
      feedback: this.editingFeedback() || null,
    }).subscribe({
      next: res => {
        this.detail.set(res.result.submission);
        this.editingAnswerId.set(null);
        this.savingAnswerId.set(null);
        this.toast.add({ severity: 'success', detail: 'Score updated.' });
      },
      error: () => this.savingAnswerId.set(null),
    });
  }

  /* ── Type-specific helpers for the template ─────────────────── */

  questionTypeLabel(type: QuizQuestionType | undefined): string {
    switch (type) {
      case 'mcq':     return 'MCQ';
      case 'yes_no':  return 'Yes / No';
      case 'open':    return 'Open Question';
      case 'reorder': return 'Reorder';
      default:        return '';
    }
  }

  isCorrectOption(answer: QuizSubmissionAnswer, optionLabel: string): boolean {
    const correct = answer.question?.correct_answer_en?.trim().toLowerCase();
    return !!correct && optionLabel.trim().toLowerCase() === correct;
  }

  isLearnerOption(answer: QuizSubmissionAnswer, optionLabel: string): boolean {
    const raw = answer.answer;
    if (!raw || !('value' in raw)) return false;
    return raw.value?.trim().toLowerCase() === optionLabel.trim().toLowerCase();
  }

  learnerOrder(answer: QuizSubmissionAnswer): string[] {
    const raw = answer.answer;
    if (!raw || !('order' in raw) || !Array.isArray(raw.order)) return [];
    return raw.order;
  }

  correctOrder(answer: QuizSubmissionAnswer): string[] {
    const raw = answer.question?.correct_answer_en ?? '';
    if (!raw.trim()) return answer.question?.options_en ?? [];
    return raw.split(/[,|]/).map(s => s.trim()).filter(Boolean);
  }

  openAnswerText(answer: QuizSubmissionAnswer): string {
    const raw = answer.answer;
    if (!raw || !('value' in raw)) return '';
    return raw.value ?? '';
  }

  yesNoLearner(answer: QuizSubmissionAnswer): 'yes' | 'no' | null {
    const raw = answer.answer;
    if (!raw || !('value' in raw)) return null;
    const v = raw.value?.toLowerCase();
    return v === 'yes' || v === 'no' ? v : null;
  }

  isYesNoCorrect(answer: QuizSubmissionAnswer, value: 'yes' | 'no'): boolean {
    return (answer.question?.correct_answer_en ?? '').toLowerCase() === value;
  }

  /* ── Header helpers ──────────────────────────────────────────── */

  statusBadgeTone(): 'success' | 'danger' | 'neutral' {
    const d = this.detail();
    if (!d || !d.quiz) return 'neutral';
    return d.quiz.status === 'active' ? 'success' : 'neutral';
  }

  passLabelTone(): 'success' | 'danger' {
    const d = this.detail();
    if (!d) return 'danger';
    const pass = d.quiz?.pass_score ?? null;
    if (pass === null || d.total_score === null) return 'success';
    return d.total_score >= pass ? 'success' : 'danger';
  }

  back(): void {
    this.router.navigate(['/admin/quizzes']);
  }
}
