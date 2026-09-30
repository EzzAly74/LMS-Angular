import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

  ngOnInit(): void {
    // LocaleService constructor already applies the saved locale via effect.
    // This call ensures the service is instantiated eagerly at app startup.
  }
}
