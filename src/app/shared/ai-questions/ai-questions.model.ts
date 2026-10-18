/**
 * "Generate with AI" for quizzes and assignments (backend D-113): the API's
 * shapes. Generated questions arrive in the forms' own question shape
 * (QuizQuestion / AssignmentQuestion), ready for buildQuestionGroup().
 */

export type AiTarget = 'quiz' | 'assignment';

/** What the AI can write; assignments' "file" questions are added by hand. */
export const AI_QUESTION_TYPES = ['mcq', 'yes_no', 'open', 'reorder'] as const;
export type AiQuestionType = (typeof AI_QUESTION_TYPES)[number];

export const AI_BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
export type AiBloomLevel = (typeof AI_BLOOM_LEVELS)[number];

export const AI_DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'] as const;
export type AiDifficulty = (typeof AI_DIFFICULTIES)[number];

/** Server limits (config/ai-questions.php), mirrored for early feedback only. */
export const AI_LIMITS = {
  files: 5,
  fileMb: 20,
  pastedMin: 50,
  pastedMax: 100_000,
  perType: 20,
  total: 40,
} as const;

export const AI_FILE_EXTENSIONS = ['pdf', 'docx', 'pptx'] as const;

/** One generated question, in the shape the quiz and assignment forms load. */
export interface AiDraftQuestion {
  type: AiQuestionType;
  score: number;
  question_en: string;
  question_ar: string;
  options_en: string[];
  options_ar: string[];
  correct_answer_en: string | null;
  correct_answer_ar: string | null;
  explanation_en: string | null;
  explanation_ar: string | null;
}

export type AiGenerationStatus = 'running' | 'succeeded' | 'failed';

export interface AiGeneration {
  id: number;
  target: AiTarget;
  status: AiGenerationStatus;
  error: string | null;
  error_message: string | null;
  counts: Partial<Record<AiQuestionType, number>>;
  sources: { name: string; kind: string }[];
  questions: AiDraftQuestion[];
  created_at: string | null;
  finished_at: string | null;
}

export interface AiUsage {
  used: number;
  limit: number;
  configured: boolean;
}

export interface AiGenerateSettings {
  counts: Partial<Record<AiQuestionType, number>>;
  difficulty: AiDifficulty;
  bloom_levels: AiBloomLevel[];
  objectives: string | null;
  score: number;
  course_id: number | null;
  assessment_type: 'pre' | 'mid' | 'post' | null;
}
