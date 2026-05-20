---
name: angular-architecture
description: >
  Build production-grade Angular 18+ applications with optimal structure,
  performance, and maintainability. Use this skill for any Angular work:
  new features, components, services, routing, state management, API
  integration, or architecture decisions. Covers standalone components,
  signals, lazy loading, SSR, and everything in between.
---

# Angular Architecture & Performance Skill

> **Mandatory read before writing a single line of Angular code.**
> This skill defines non-negotiable patterns. Deviating from them without
> explicit instruction from the human is not allowed.

---

## 0. Version Baseline

- **Angular**: 18+ (standalone APIs, signals, defer blocks)
- **Node**: 20 LTS
- **TypeScript**: 5.4+ (`strict: true` always on)
- **RxJS**: 7.x (minimise usage — prefer signals for state)
- **Build**: `@angular/build` (esbuild-based, NOT webpack)

If the project uses an older version, flag it before proceeding.

---

## 1. Project Structure

```
src/
├── app/
│   ├── core/                      # Singleton services, guards, interceptors
│   │   ├── auth/
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.guard.ts
│   │   │   └── auth.interceptor.ts
│   │   ├── http/
│   │   │   └── api.interceptor.ts
│   │   └── core.providers.ts      # provideCore() function
│   │
│   ├── shared/                    # Reusable dumb components, pipes, directives
│   │   ├── components/
│   │   ├── pipes/
│   │   ├── directives/
│   │   └── index.ts               # barrel export
│   │
│   ├── features/                  # Feature modules (each = lazy-loaded route)
│   │   ├── dashboard/
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── dashboard.component.ts
│   │   │   ├── components/        # feature-local dumb components
│   │   │   ├── services/          # feature-local services
│   │   │   └── store/             # feature signal store
│   │   └── courses/
│   │       └── ...
│   │
│   ├── layout/                    # Shell: sidebar, header, footer
│   │   ├── shell.component.ts
│   │   ├── sidebar/
│   │   └── header/
│   │
│   ├── app.routes.ts              # Root route config (lazy loads features)
│   ├── app.config.ts              # provideRouter, provideHttpClient, etc.
│   └── app.component.ts           # Root component (minimal — just <router-outlet>)
│
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
│
└── assets/
```

### Rules
- **No NgModules** — use standalone components everywhere.
- **No `app.module.ts`** — bootstrap via `bootstrapApplication()` in `main.ts`.
- Every feature directory is a self-contained vertical slice.
- `core/` services are provided `{ providedIn: 'root' }` — never re-provided.
- `shared/` contains only **dumb** (presentational) components with no injected services.
- Never import from a sibling feature — if two features share something, it goes to `shared/`.

---

## 2. Standalone Components (mandatory)

```typescript
// ✅ Every component is standalone
@Component({
  selector: 'app-course-card',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`,
})
export class CourseCardComponent {
  @Input({ required: true }) course!: Course;
}
```

```typescript
// ❌ Never use NgModules
@NgModule({ declarations: [CourseCardComponent] }) // FORBIDDEN
```

---

## 3. Signals — State Management

Use **Angular Signals** as the primary reactive primitive. Use RxJS only for async events that are inherently streams (HTTP, WebSocket, DOM events). Do not mix them carelessly.

### 3.1 Component-level state

```typescript
@Component({ ... changeDetection: ChangeDetectionStrategy.OnPush })
export class CoursesComponent {
  private coursesService = inject(CoursesService);

  // State signals
  protected readonly courses    = signal<Course[]>([]);
  protected readonly isLoading  = signal(false);
  protected readonly searchTerm = signal('');

  // Derived state — computed() replaces selectors
  protected readonly filteredCourses = computed(() =>
    this.courses().filter(c =>
      c.title.toLowerCase().includes(this.searchTerm().toLowerCase())
    )
  );

  // Effects for side effects only (logging, localStorage, etc.)
  private readonly syncEffect = effect(() => {
    localStorage.setItem('lastSearch', this.searchTerm());
  });
}
```

### 3.2 Feature store (SignalStore pattern)

For any state shared between more than one component, create a dedicated store:

```typescript
// features/courses/store/courses.store.ts
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';

type CoursesState = {
  courses: Course[];
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: CoursesState = {
  courses: [],
  selectedId: null,
  isLoading: false,
  error: null,
};

export const CoursesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ courses, selectedId }) => ({
    selectedCourse: computed(() =>
      courses().find(c => c.id === selectedId()) ?? null
    ),
    activeCourses: computed(() =>
      courses().filter(c => c.status === 'active')
    ),
  })),

  withMethods((store, coursesService = inject(CoursesService)) => ({
    async loadCourses() {
      patchState(store, { isLoading: true, error: null });
      try {
        const courses = await firstValueFrom(coursesService.getAll());
        patchState(store, { courses, isLoading: false });
      } catch (err) {
        patchState(store, { error: 'Failed to load', isLoading: false });
      }
    },
    selectCourse(id: string) {
      patchState(store, { selectedId: id });
    },
  }))
);
```

### 3.3 RxJS → Signal bridge

```typescript
// Convert observables to signals at the boundary
protected readonly user = toSignal(this.authService.currentUser$, {
  initialValue: null,
});
```

---

## 4. Routing

### 4.1 Root routes — all lazy

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Dashboard',
      },
      {
        path: 'courses',
        loadChildren: () =>
          import('./features/courses/courses.routes').then(m => m.COURSES_ROUTES),
      },
    ],
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  { path: '**', redirectTo: 'dashboard' },
];
```

### 4.2 Feature routes

```typescript
// features/courses/courses.routes.ts
export const COURSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./courses-list.component').then(m => m.CoursesListComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./course-detail.component').then(m => m.CourseDetailComponent),
    resolve: { course: courseResolver },
  },
];
```

### 4.3 Guards (functional)

```typescript
// ✅ Functional guard — no class needed
export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/auth/login']);
};
```

---

## 5. HTTP & API Layer

### 5.1 provideHttpClient

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
  ],
};
```

### 5.2 Typed API service

```typescript
// core/http/courses-api.service.ts
@Injectable({ providedIn: 'root' })
export class CoursesApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/courses`;

  getAll(params?: CourseFilters): Observable<PaginatedResponse<Course>> {
    return this.http.get<PaginatedResponse<Course>>(this.base, { params: params as any });
  }

  getById(id: string): Observable<Course> {
    return this.http.get<Course>(`${this.base}/${id}`);
  }

  create(payload: CreateCourseDto): Observable<Course> {
    return this.http.post<Course>(this.base, payload);
  }

  update(id: string, payload: Partial<CreateCourseDto>): Observable<Course> {
    return this.http.patch<Course>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
```

### 5.3 Interceptors (functional)

```typescript
// core/http/auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

// core/http/error.interceptor.ts
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) router.navigate(['/auth/login']);
      return throwError(() => err);
    })
  );
};
```

---

## 6. Performance

### 6.1 OnPush everywhere

```typescript
// Every component — no exceptions
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
})
```

### 6.2 @defer — replace *ngIf for heavy components

```html
<!-- Replaces ngIf for anything not immediately visible -->
@defer (on viewport) {
  <app-analytics-chart [data]="chartData()" />
} @loading {
  <app-skeleton height="300px" />
} @error {
  <p>Chart failed to load.</p>
}

<!-- Interaction-triggered -->
@defer (on interaction(triggerRef)) {
  <app-rich-editor />
}
```

### 6.3 trackBy in @for

```html
<!-- ✅ Always provide track -->
@for (course of courses(); track course.id) {
  <app-course-card [course]="course" />
}

<!-- ❌ Never iterate without track -->
@for (course of courses()) { ... }
```

### 6.4 Pipe over method in template

```typescript
// ✅ Pure pipe — memoised by Angular
@Pipe({ name: 'courseStatus', pure: true, standalone: true })
export class CourseStatusPipe implements PipeTransform {
  transform(status: string): string { ... }
}
```

```html
<!-- ✅ -->
{{ course.status | courseStatus }}

<!-- ❌ Method call re-runs on every CD cycle -->
{{ getCourseStatus(course) }}
```

### 6.5 Image optimisation

```html
<!-- Always use NgOptimizedImage -->
<img ngSrc="course-thumbnail.jpg" width="400" height="300"
     [priority]="isAboveFold" alt="..." />
```

### 6.6 Virtual scrolling for long lists

```typescript
// For lists > 50 items
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  imports: [ScrollingModule],
  template: `
    <cdk-virtual-scroll-viewport itemSize="72" class="viewport">
      <app-course-row *cdkVirtualFor="let c of courses()" [course]="c" />
    </cdk-virtual-scroll-viewport>
  `
})
```

### 6.7 Bundle budget targets

In `angular.json`, enforce limits:

```json
"budgets": [
  { "type": "initial", "maximumWarning": "500kb", "maximumError": "1mb" },
  { "type": "anyComponentStyle", "maximumWarning": "4kb" }
]
```

---

## 7. TypeScript Strictness

`tsconfig.json` must always include:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### DTOs and types

```typescript
// types/course.types.ts

export type CourseStatus = 'building' | 'pending' | 'active';
export type CourseType   = 'online' | 'offline' | 'blended' | 'external_link';

export interface Course {
  readonly id:          string;
  readonly title:       string;
  readonly description: string;
  readonly status:      CourseStatus;
  readonly type:        CourseType;
  readonly instructor:  UserSummary;
  readonly createdAt:   string; // ISO 8601
}

// Separate DTOs from domain types
export interface CreateCourseDto {
  title:       string;
  description: string;
  type:        CourseType;
  instructorId: string;
}

export interface PaginatedResponse<T> {
  data:  T[];
  meta: { total: number; page: number; perPage: number; lastPage: number };
}
```

---

## 8. Forms

### 8.1 Typed Reactive Forms

```typescript
// ✅ Always strongly-typed
readonly courseForm = new FormGroup({
  title:       new FormControl('',   { nonNullable: true, validators: [Validators.required] }),
  description: new FormControl('',   { nonNullable: true, validators: [Validators.required] }),
  type:        new FormControl<CourseType>('online', { nonNullable: true }),
  maxLearners: new FormControl(30,   { nonNullable: true, validators: [Validators.min(1)] }),
});

// Derive type from form for submit handler
type CourseFormValue = typeof this.courseForm.value;
```

### 8.2 Error display helper

```typescript
@Pipe({ name: 'fieldError', standalone: true, pure: false })
export class FieldErrorPipe implements PipeTransform {
  transform(control: AbstractControl | null): string {
    if (!control?.errors || !control.dirty) return '';
    if (control.errors['required'])   return 'This field is required.';
    if (control.errors['minlength'])  return `Min ${control.errors['minlength'].requiredLength} chars.`;
    if (control.errors['email'])      return 'Invalid email address.';
    return 'Invalid value.';
  }
}
```

---

## 9. Auth (Sanctum token flow)

```typescript
// core/auth/auth.service.ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'nas_token';
  private readonly http      = inject(HttpClient);
  private readonly router    = inject(Router);

  // Signal — reactive auth state throughout the app
  readonly currentUser = signal<AuthUser | null>(this.loadUser());
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  login(credentials: LoginDto): Observable<void> {
    return this.http.post<{ token: string; user: AuthUser }>(
      `${environment.apiUrl}/v1/auth/login`, credentials
    ).pipe(
      tap(({ token, user }) => {
        localStorage.setItem(this.TOKEN_KEY, token);
        this.currentUser.set(user);
      }),
      map(() => void 0)
    );
  }

  logout(): void {
    this.http.post(`${environment.apiUrl}/v1/auth/logout`, {}).subscribe();
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private loadUser(): AuthUser | null {
    const token = this.getToken();
    if (!token) return null;
    // Optionally decode JWT payload
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user ?? null;
    } catch { return null; }
  }
}
```

---

## 10. i18n / RTL (required for NAS LMS)

```typescript
// app.config.ts
import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
registerLocaleData(localeAr);
```

```typescript
// core/i18n/language.service.ts
@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly lang = signal<'en' | 'ar'>('en');
  readonly dir  = computed(() => this.lang() === 'ar' ? 'rtl' : 'ltr');
  readonly font = computed(() =>
    this.lang() === 'ar' ? 'var(--font-arabic)' : 'var(--font-english)'
  );

  toggle(): void {
    this.lang.update(l => l === 'en' ? 'ar' : 'en');
    document.documentElement.lang = this.lang();
    document.documentElement.dir  = this.dir();
  }
}
```

```html
<!-- shell.component.html — apply at root -->
<div [dir]="langService.dir()" [style.font-family]="langService.font()">
  <router-outlet />
</div>
```

- Use `start`/`end` instead of `left`/`right` in all CSS.
- Directional icons: apply `[style.transform]="dir()==='rtl' ? 'scaleX(-1)' : ''"`.

---

## 11. Design Token Integration

NAS LMS uses CSS custom properties defined in `resources/css/app.css` (Laravel side).
In the Angular project, **copy the token declarations** into `src/styles/tokens.css` and import in `styles.css`.

```css
/* src/styles.css */
@import './styles/tokens.css';   /* All --color-*, --spacing-*, etc. */
@import './styles/utilities.css'; /* .nas-card, .btn-primary, .badge-* etc. */
```

```typescript
// Use tokens in component styles via :host
@Component({
  styles: [`
    :host {
      display: block;
      background: var(--surface-card);
      border-radius: var(--radius-control-lg);
      box-shadow: var(--shadow-sm);
      padding: var(--spacing-8XS);  /* 16px */
    }
  `]
})
```

**Never use hardcoded hex values. Always reference design tokens.**

---

## 12. File & Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Component | `kebab-case.component.ts` | `course-card.component.ts` |
| Service | `kebab-case.service.ts` | `courses-api.service.ts` |
| Store | `kebab-case.store.ts` | `courses.store.ts` |
| Guard | `kebab-case.guard.ts` | `auth.guard.ts` |
| Interceptor | `kebab-case.interceptor.ts` | `auth.interceptor.ts` |
| Pipe | `kebab-case.pipe.ts` | `course-status.pipe.ts` |
| Types | `kebab-case.types.ts` | `course.types.ts` |
| Routes | `kebab-case.routes.ts` | `courses.routes.ts` |
| Selector prefix | `app-` | `<app-course-card>` |
| Class names | `PascalCase` | `CourseCardComponent` |
| Signals | `camelCase` noun | `isLoading`, `courses` |
| Observables | `camelCase$` suffix | `courses$` |

---

## 13. File Separation — Non-Negotiable

**Every component = 3 separate files. No exceptions.**

```
course-card.component.ts       ← class + @Component decorator only
course-card.component.html     ← template only
course-card.component.css      ← styles only
```

```typescript
// ✅ CORRECT
@Component({
  selector: 'app-course-card',
  standalone: true,
  templateUrl: './course-card.component.html',   // ← external file
  styleUrl:    './course-card.component.css',    // ← external file
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseCardComponent { ... }
```

```typescript
// ❌ FORBIDDEN — never inline template or styles in the .ts file
@Component({
  selector: 'app-course-card',
  template: `<div class="card">...</div>`,        // ← NO
  styles: [`.card { background: red; }`],         // ← NO
})
```

**Why:** Inline templates break IDE autocomplete, syntax highlighting, and formatting for HTML/CSS. They make the `.ts` file unreadable, impossible to diff cleanly, and unworkable once the template grows beyond 5 lines — which it always does.

The **only** acceptable exception is a component whose template is literally one line and will never grow (e.g. a pure router shell: `<router-outlet />`). Even then, prefer external files.

---

## 14. Anti-Patterns — Never Do These

```typescript
// ❌ NgModules
@NgModule({ ... })

// ❌ Constructor injection (use inject() function)
constructor(private service: MyService) {}
// ✅
private service = inject(MyService);

// ❌ Any type
const data: any = response;
// ✅
const data: Course[] = response;

// ❌ Default ChangeDetection
@Component({ changeDetection: ChangeDetectionStrategy.Default })
// ✅ Always OnPush

// ❌ Method calls in templates
{{ formatDate(item.createdAt) }}
// ✅ Pure pipe

// ❌ Direct DOM manipulation
document.querySelector('.modal').style.display = 'block';
// ✅ Signals + @if / @defer / Angular animations

// ❌ Subscribing in component without takeUntilDestroyed
this.service.data$.subscribe(d => this.data = d);
// ✅
this.service.data$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(...)
// OR just: toSignal(this.service.data$)

// ❌ Importing between feature modules
import { CoursesStore } from '../courses/store/courses.store'; // from dashboard!
// ✅ Lift shared state to shared/ or core/

// ❌ providedIn a component (unless intentionally scoped)
@Injectable({ providedIn: CourseDetailComponent })
```

---

## 14. Pre-flight Checklist

Before committing any Angular code, verify:

- [ ] All components: `standalone: true` + `ChangeDetectionStrategy.OnPush`
- [ ] All routes: lazy-loaded via `loadComponent` / `loadChildren`
- [ ] All `@for` loops: have `track` expression
- [ ] No method calls in templates — pipes used instead
- [ ] All HTTP calls: typed with generics (`http.get<Course[]>`)
- [ ] Signals used for all component state (not `@Input`-mutated properties)
- [ ] No hardcoded colours — CSS tokens only
- [ ] `ng build --configuration production` passes with zero errors
- [ ] Bundle initial chunk < 500 KB
- [ ] RTL tested by toggling `dir` attribute
