import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { fallbackRoute } from '../../../../core/guards/permission.guard';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);
  readonly locale = inject(LocaleService);

  readonly loading      = signal(false);
  readonly error        = signal<string | null>(null);
  readonly submitted    = signal(false);
  readonly showPassword = signal(false);

  readonly dots = Array(16).fill(0);

  readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  get f() { return this.form.controls; }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    this.auth.login(email!, password!)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next:  () => {
          // Land on the first sidebar destination the new admin actually
          // has access to. Falls back to /admin/dashboard for super
          // admins (who can see everything) and for legacy `view_keys`-
          // less admins (the helper returns /admin/dashboard whenever
          // dashboard is reachable).
          const target = this.auth.hasView('view-dashboard')
            ? '/admin/dashboard'
            : fallbackRoute(this.auth);
          this.router.navigate([target]);
        },
        error: err => {
          this.error.set(err.error?.message ?? err.message ?? 'Login failed.');
        },
      });
  }
}
