import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiParams, ApiService } from '../../../core/services/api.service';
import { PaginatedResponse } from '../../../core/models/api-response.model';
import { API } from '../../../core/constants/api.constants';
import { saveBlob } from '../../../core/utils/save-blob';
import {
  AssigneeType,
  Assignees,
  QualificationDetail,
  QualificationImportReport,
  QualificationPayload,
  QualificationRow,
} from '../models/qualification.model';

export type TransferFormat = 'xlsx' | 'csv';

/**
 * admin/qualification-skills (D5). Authorization is the API's
 * (view-qualifications); nothing here decides access.
 */
@Injectable({ providedIn: 'root' })
export class QualificationsApiService {
  private readonly api = inject(ApiService);
  private readonly base = API.ADMIN_QUALIFICATIONS;

  list(params: ApiParams): Observable<PaginatedResponse<QualificationRow>> {
    return this.api.getPaginated<QualificationRow>(this.base, params);
  }

  get(id: number): Observable<QualificationDetail> {
    return this.api.get<QualificationDetail>(`${this.base}/${id}`).pipe(map(r => r.result));
  }

  create(body: QualificationPayload): Observable<QualificationDetail> {
    return this.api.post<QualificationDetail>(this.base, body).pipe(map(r => r.result));
  }

  update(id: number, body: QualificationPayload): Observable<QualificationDetail> {
    return this.api.put<QualificationDetail>(`${this.base}/${id}`, body).pipe(map(r => r.result));
  }

  delete(id: number): Observable<void> {
    return this.api.delete(`${this.base}/${id}`).pipe(map(() => undefined));
  }

  assignees(search: string, type: AssigneeType): Observable<Assignees> {
    const params: ApiParams = { type };
    if (search.trim()) params['search'] = search.trim();
    return this.api.get<Assignees>(`${this.base}/assignees`, params).pipe(map(r => r.result));
  }

  /** The list as currently searched. */
  export(format: TransferFormat, search: string): Observable<void> {
    const params: ApiParams = { format };
    if (search) params['search'] = search;
    return this.api.getBlob(`${this.base}/export`, params).pipe(map(blob => saveBlob(blob, `qualifications.${format}`)));
  }

  importTemplate(): Observable<void> {
    return this.api.getBlob(`${this.base}/import-template`, { format: 'xlsx' })
      .pipe(map(blob => saveBlob(blob, 'qualifications-template.xlsx')));
  }

  import(file: File): Observable<QualificationImportReport> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.post<QualificationImportReport>(`${this.base}/import`, body).pipe(map(r => r.result));
  }
}
