import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PhoneFrameComponent, PhoneTab } from './phone-frame.component';
import { AcademyScreenComponent } from './screens/academy-screen.component';
import { CourseDetailScreenComponent } from './screens/course-detail-screen.component';
import { MyLearningScreenComponent } from './screens/my-learning-screen.component';
import { ResultPanelComponent } from '../shared/result-panel.component';
import { SandboxConfigService } from '../core/sandbox-config.service';
import { ApiCallResult } from '../core/mobile-api.service';

type Screen = 'academy' | 'detail' | 'learning';

/**
 * Figma-faithful mobile preview: renders the learner journey screens
 * inside a phone frame, navigated in-frame (Academy → Detail, and
 * Academy ↔ My Learning), every screen bound to the live mobile APIs
 * through the isolated client. A side inspector shows the raw request /
 * response of the most recent call for verification.
 */
@Component({
  selector: 'sbx-mobile-preview',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PhoneFrameComponent,
    AcademyScreenComponent,
    CourseDetailScreenComponent,
    MyLearningScreenComponent,
    ResultPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!connected()) {
      <div class="warn">
        <strong>Not connected.</strong>
        Set the shared token + employee code on the
        <a routerLink="../config">Connection</a> page to load live data.
      </div>
    }

    <div class="prev">
      <div class="prev__stage">
        <sbx-phone-frame
          [title]="title()"
          [showBack]="screen() === 'detail'"
          [showNav]="screen() !== 'detail'"
          [activeTab]="tab()"
          (back)="goAcademy()">
          @switch (screen()) {
            @case ('academy') {
              <sbx-academy-screen
                (openCourse)="openDetail($event)"
                (goLearning)="goLearning()"
                (apiResult)="onResult($event)" />
            }
            @case ('detail') {
              <sbx-course-detail-screen
                [courseId]="courseId()"
                (back)="goAcademy()"
                (enrol)="onEnrolled()"
                (apiResult)="onResult($event)" />
            }
            @case ('learning') {
              <sbx-my-learning-screen (apiResult)="onResult($event)" />
            }
          }
        </sbx-phone-frame>

        <div class="prev__tabs">
          <button [class.is-active]="screen() === 'academy'" (click)="goAcademy()">Academy</button>
          <button [class.is-active]="screen() === 'learning'" (click)="goLearning()">My Learning</button>
        </div>
      </div>

      <aside class="prev__inspector">
        <header>
          <h3>Live API inspector</h3>
          <small>Last call made by the screen on the left</small>
        </header>
        @if (lastResult()) {
          <sbx-result-panel [result]="lastResult()" />
        } @else {
          <div class="prev__empty">Interact with the phone to fire a request.</div>
        }
      </aside>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .warn { background: #fff6e5; border: 1px solid #f3d488; color: #8a5a00; padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 13px; }
      .warn a { color: #0c2427; font-weight: 600; }
      .prev { display: flex; gap: 28px; align-items: flex-start; flex-wrap: wrap; }
      .prev__stage { display: flex; flex-direction: column; align-items: center; gap: 14px; }
      .prev__tabs { display: inline-flex; background: #e9edf0; border-radius: 999px; padding: 3px; }
      .prev__tabs button { border: 0; background: none; padding: 7px 18px; border-radius: 999px; font-family: inherit; font-size: 13px; font-weight: 600; color: #5b6470; cursor: pointer; }
      .prev__tabs button.is-active { background: #fff; color: #0c2427; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
      .prev__inspector { flex: 1; min-width: 360px; background: #fff; border: 1px solid #e3e6ea; border-radius: 14px; padding: 16px; max-height: 832px; overflow: auto; }
      .prev__inspector header h3 { margin: 0; font-size: 15px; color: #1f2329; }
      .prev__inspector header small { color: #8c8c8c; font-size: 12px; }
      .prev__empty { margin-top: 16px; padding: 24px; text-align: center; color: #8c8c8c; font-size: 13px; background: #f7f8f9; border-radius: 10px; }
    `,
  ],
})
export class MobilePreviewComponent {
  private readonly cfg = inject(SandboxConfigService);

  readonly connected = this.cfg.connected;
  readonly screen = signal<Screen>('academy');
  readonly courseId = signal<number>(0);
  readonly lastResult = signal<ApiCallResult | null>(null);

  readonly title = computed(() => {
    switch (this.screen()) {
      case 'academy': return 'Academy';
      case 'detail': return 'Course Details';
      case 'learning': return 'My Learning';
    }
  });

  readonly tab = computed<PhoneTab>(() => (this.screen() === 'learning' ? 'profile' : 'services'));

  goAcademy(): void { this.screen.set('academy'); }
  goLearning(): void { this.screen.set('learning'); }

  openDetail(id: number): void {
    this.courseId.set(id);
    this.screen.set('detail');
  }

  onResult(r: ApiCallResult): void {
    this.lastResult.set(r);
  }

  /** After a successful enrolment, jump to My Learning so the new active course shows. */
  onEnrolled(): void {
    setTimeout(() => this.goLearning(), 900);
  }
}
