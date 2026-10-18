import { Injectable } from '@angular/core';
import type { AiDraftQuestion, AiTarget } from './ai-questions.model';

/**
 * Hands generated questions from the Quizzes / Assignments page to the Add
 * form it opens next. In memory only and read once: a reload or a later visit
 * to the form starts empty, and nothing is saved until the form's Save.
 */
@Injectable({ providedIn: 'root' })
export class AiQuestionDraftService {
  private readonly drafts = new Map<AiTarget, AiDraftQuestion[]>();

  set(target: AiTarget, questions: readonly AiDraftQuestion[]): void {
    this.drafts.set(target, [...questions]);
  }

  take(target: AiTarget): AiDraftQuestion[] {
    const questions = this.drafts.get(target) ?? [];
    this.drafts.delete(target);
    return questions;
  }
}
