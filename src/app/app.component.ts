import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LocaleService } from './core/services/locale.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private locale = inject(LocaleService);

  ngOnInit(): void {
    // LocaleService constructor already applies the saved locale via effect.
    // This call ensures the service is instantiated eagerly at app startup.
  }
}
