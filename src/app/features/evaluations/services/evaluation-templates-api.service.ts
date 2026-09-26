import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiParams, ApiService } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';
import {
  BuilderOptions,
  EvaluationTemplateDetail,
  EvaluationTemplatePayload,
  ImportReport,
} from '../models/evaluation.model';

export type TransferFormat = 'xlsx' | 'csv';

/**
 * The evaluation template builder and its Import / Export (D4, D-054).
 * Authorization is the API's (view-evaluations); nothing here decides access.
 */
@Injectable({ providedIn: 'root' })
export class EvaluationTemplatesApiService {
  private readonly api = inject(ApiService);
  private readonly base = API.ADMIN_EVALUATION_TEMPLATES;

  options(): Observable<BuilderOptions> {
    return this.api.get<BuilderOptions>(`${this.base}/options`).pipe(map(r => r.result));
  }

  get(id: number | string): Observable<EvaluationTemplateDetail> {
    return this.api.get<EvaluationTemplateDetail>(`${this.base}/${encodeURIComponent(String(id))}`).pipe(map(r => r.result));
  }

  create(body: EvaluationTemplatePayload): Observable<EvaluationTemplateDetail> {
    return this.api.post<EvaluationTemplateDetail>(this.base, body).pipe(map(r => r.result));
  }

  update(id: number, body: EvaluationTemplatePayload): Observable<EvaluationTemplateDetail> {
    return this.api.put<EvaluationTemplateDetail>(`${this.base}/${id}`, body).pipe(map(r => r.result));
  }

  /** The list as currently filtered (the same params as the list request). */
  export(format: TransferFormat, filters: ApiParams): Observable<void> {
    return this.api.getBlob(`${this.base}/export`, { ...filters, format })
      .pipe(map(blob => saveBlob(blob, `evaluation-templates.${format}`)));
  }

  importTemplate(format: TransferFormat): Observable<void> {
    return this.api.getBlob(`${this.base}/import-template`, { format })
      .pipe(map(blob => saveBlob(blob, `evaluation-templates-template.${format}`)));
  }

  import(file: File): Observable<ImportReport> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.post<ImportReport>(`${this.base}/import`, body).pipe(map(r => r.result));
  }
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
