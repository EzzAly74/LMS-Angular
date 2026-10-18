import { Routes } from '@angular/router';

/** AI Assessment builder (D-113): the library, a new assessment, one assessment's wizard. */
export const AI_ASSESSMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/ai-assessment-list/ai-assessment-list.component').then(m => m.AiAssessmentListComponent),
    title: 'AI Assessments — 2B Academy',
  },
  {
    path: 'new', data: { permission: 'create-ai-assessments' },
    loadComponent: () => import('./pages/ai-assessment-editor/ai-assessment-editor.component').then(m => m.AiAssessmentEditorComponent),
    title: 'New AI Assessment — 2B Academy',
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/ai-assessment-editor/ai-assessment-editor.component').then(m => m.AiAssessmentEditorComponent),
    title: 'AI Assessment — 2B Academy',
  },
];
