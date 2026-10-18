/**
 * AI Assessment builder (D-113) — the API's shapes, typed end to end.
 * Mirrors app/AiAssessments/QuestionType.php on the backend.
 */

export type AssessmentType = 'pre' | 'post' | 'quiz';
export type ContentLanguage = 'en' | 'ar';
export type AssessmentDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type AssessmentStatus = 'draft' | 'generating' | 'ready';
export type QuestionStatus = 'pending' | 'approved' | 'flagged';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type SourceKind = 'pdf' | 'docx' | 'pptx' | 'text';
export type ExportFormat = 'docx' | 'pdf' | 'xlsx';
export type ExportVariant = 'trainer' | 'learner';

export const QUESTION_TYPES = ['mcq', 'multi', 'true_false', 'short', 'fill_blank', 'matching', 'scenario'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
export type BloomLevel = (typeof BLOOM_LEVELS)[number];

export const ASSESSMENT_TYPES: readonly AssessmentType[] = ['pre', 'post', 'quiz'];
export const CONTENT_LANGUAGES: readonly ContentLanguage[] = ['en', 'ar'];
export const DIFFICULTIES: readonly AssessmentDifficulty[] = ['easy', 'medium', 'hard', 'mixed'];

/** Limits the server enforces (config/ai-assessments.php); the UI mirrors them for early feedback. */
export const LIMITS = {
  perType: 20,
  total: 60,
  sources: 10,
  fileMb: 20,
  pastedMin: 50,
  pastedMax: 100_000,
} as const;

export type QuestionCounts = Partial<Record<QuestionType, number>>;

export interface MatchingPair { left: string; right: string }

/** The stored answer, by type (see QuestionType.php). */
export type QuestionAnswer =
  | { indexes: number[] }      // mcq, multi, scenario
  | { value: boolean }         // true_false
  | { text: string }           // short
  | { answers: string[] }      // fill_blank
  | null;                      // matching: the pairs are the key

export interface AiQuestion {
  id: number;
  position: number;
  type: QuestionType;
  context: string | null;
  prompt: string;
  /** string[] for choice types, MatchingPair[] for matching, null otherwise. */
  options: string[] | MatchingPair[] | null;
  answer: QuestionAnswer;
  explanation: string | null;
  source_ref: string | null;
  bloom: BloomLevel | null;
  difficulty: QuestionDifficulty | null;
  status: QuestionStatus;
}

export interface AiSource {
  id: number;
  kind: SourceKind;
  name: string;
  size: number;
  units: number | null;
  chars: number;
  created_at: string | null;
}

export interface IdTitle { id: number; title: string }

export interface AiAssessment {
  id: number;
  title: string;
  type: AssessmentType;
  content_language: ContentLanguage;
  difficulty: AssessmentDifficulty;
  audience: string | null;
  objectives: string | null;
  bloom_levels: BloomLevel[];
  question_counts: QuestionCounts;
  version: number;
  status: AssessmentStatus;
  last_error: string | null;
  last_error_message: string | null;
  generation_started_at: string | null;
  course: IdTitle | null;
  sources: AiSource[];
  questions: AiQuestion[];
  updated_at: string | null;
}

export interface AiAssessmentRow {
  id: number;
  title: string;
  type: AssessmentType;
  content_language: ContentLanguage;
  difficulty: AssessmentDifficulty;
  status: AssessmentStatus;
  version: number;
  questions_count: number;
  approved_count: number;
  course: IdTitle | null;
  author: { id: number; name: string } | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface AiUsage {
  used: number;
  limit: number;
  configured: boolean;
}

export interface AiAssessmentDetails {
  title: string;
  type: AssessmentType;
  content_language: ContentLanguage;
  difficulty: AssessmentDifficulty;
  audience: string | null;
  course_id: number | null;
  objectives: string | null;
  bloom_levels: BloomLevel[];
  question_counts: QuestionCounts;
}

/** What a question edit sends: the stored shape of its type. */
export interface AiQuestionPayload {
  prompt: string;
  context?: string | null;
  options?: string[] | MatchingPair[];
  answer?: QuestionAnswer;
  explanation: string | null;
  source_ref: string | null;
  bloom: BloomLevel | null;
  difficulty: QuestionDifficulty | null;
  status?: QuestionStatus;
}

export interface AiLibraryFilters {
  search?: string;
  type?: AssessmentType | null;
  content_language?: ContentLanguage | null;
  page: number;
  per_page: number;
}

export function usesIndexes(type: QuestionType): boolean {
  return type === 'mcq' || type === 'multi' || type === 'scenario';
}

/** Option letters as printed in the exports, by content language. */
export const OPTION_LETTERS: Record<ContentLanguage, readonly string[]> = {
  en: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  ar: ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'],
};

export const BLANK = '_____';
