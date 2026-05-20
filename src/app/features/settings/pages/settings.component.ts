import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api.constants';

interface Setting {
  id: number;
  key: string;
  value: string;
  type: string;
  label: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, CardModule, ButtonModule, InputTextModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private api     = inject(ApiService);
  private fb      = inject(FormBuilder);
  private message = inject(MessageService);

  settings = signal<Setting[]>([]);
  loading  = signal(true);
  saving   = signal(false);
  form     = this.fb.group({});

  ngOnInit(): void {
    this.api.get<Setting[]>(API.ADMIN_SETTINGS).subscribe({
      next: res => {
        this.settings.set(res.result);
        const controls: Record<string, string> = {};
        res.result.forEach(s => { controls[s.key] = s.value ?? ''; });
        this.form = this.fb.group(controls);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save(): void {
    this.saving.set(true);
    this.api.put(API.ADMIN_SETTINGS, { settings: this.form.value }).subscribe({
      next: () => {
        this.message.add({ severity: 'success', detail: 'Settings saved.' });
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }
}
