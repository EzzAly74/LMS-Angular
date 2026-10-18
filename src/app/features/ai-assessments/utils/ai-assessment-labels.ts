import type { NasStatusTone } from '../../../shared/nas/nas-status-badge/nas-status-badge.component';
import type { AssessmentStatus, AssessmentType, QuestionStatus } from '../models/ai-assessment.model';

/** Badge colours, one place for the list and the editor. */
export function statusTone(status: AssessmentStatus): NasStatusTone {
  return status === 'ready' ? 'success' : status === 'generating' ? 'info' : 'neutral';
}

export function typeTone(type: AssessmentType): NasStatusTone {
  return type === 'pre' ? 'sky' : type === 'post' ? 'teal' : 'warning';
}

export function questionTone(status: QuestionStatus): NasStatusTone {
  return status === 'approved' ? 'success' : status === 'flagged' ? 'danger' : 'neutral';
}

/** "1.2 MB" / "640 KB", digits kept left-to-right in Arabic too. */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
