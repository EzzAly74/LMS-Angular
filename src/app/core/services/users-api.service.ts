import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { API } from '../constants/api.constants';
import { ApiResponse, PaginatedResponse } from '../models/api-response.model';

export interface User {
  id: number;
  name: string;
  email: string;
  job_title?: string | null;
  department_name?: string | null;
  learner_type?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly api = inject(ApiService);

  list(params?: Record<string, string | number | boolean | null | undefined>): Observable<PaginatedResponse<User>> {
    return this.api.getPaginated<User>(API.USERS, params);
  }

  update(id: number, body: Partial<User>): Observable<ApiResponse<User>> {
    return this.api.put<User>(`${API.USERS}/${id}`, body);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this.api.delete(`${API.USERS}/${id}`);
  }
}
