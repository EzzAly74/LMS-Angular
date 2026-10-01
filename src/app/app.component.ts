import { Component, HostListener, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { LocaleService } from './core/services/locale.service';
import { NasToasterComponent } from './shared/nas/nas-toaster/nas-toaster.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NasToasterComponent],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private locale = inject(LocaleService);
  private auth = inject(AuthService);

  ngOnInit(): void {
    // LocaleService constructor already applies the saved locale via effect.
    // This call ensures the service is instantiated eagerly at app startup.
  }

  /** Back on the tab: pick up any role change made meanwhile (D-073). */
  @HostListener('window:focus')
  onFocus(): void {
    this.auth.refreshPermissions();
  }
}
