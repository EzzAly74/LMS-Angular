# LMS Project Overview

The **NAS Learning Management System (NAS LMS)** is an enterprise corporate-learning platform that lets an organization run its entire employee learning lifecycle — from publishing a course catalogue, enrolling employees into cohorts, delivering online/offline/hybrid courses, tracking live-session attendance, administering quizzes and assignments, collecting course feedback, through to issuing verifiable completion certificates and reporting on workforce compliance.

The platform is delivered as **two cooperating products built on a single backend**:

1. **Admin Dashboard (web)** — an Angular single-page application used by administrators, training coordinators, and instructors to manage the catalogue, learners, cohorts, content, assessments, certificates, settings, and reporting.
2. **Employee Mobile App (API-consumed)** — a server-to-server REST surface (consumed by the HR mobile application) that powers the employee-facing journey: discover courses (Academy), enrol, view *My Learning*, mark attendance via an instructor passcode, rate courses, and view/download certificates.

The current codebase is the product of a deliberate **migration of a legacy in-production ASP.NET MVC system into a modern, standalone REST API (Laravel) plus a localized Angular frontend**, governed by a shared `SSOT.md` ("Single Source of Truth") contract that mandates: never mutate the frozen legacy MVC/Blade layer, expose all new capability through an additive, versioned `/api/v1` REST API secured with Laravel Sanctum and `spatie/laravel-permission`, and reproduce all business rules, validations, permissions, translations, and workflows faithfully. The UI is implemented against Figma designs with node-ID-level traceability embedded in code comments across both repositories.

**Platform scale (verified from the codebase):**

| Dimension | Backend (`2B-Academy`, Laravel 11) | Frontend (`2B-Academy-Angular`, Angular 18) |
| --- | --- | --- |
| API endpoints | ~220+ registered under `/api/v1` | consumes them via typed API services |
| Domain route files | 40 | 25 feature areas |
| Controllers | 104 (47 REST API controllers) | — |
| Eloquent models | 59 | — |
| Database migrations | 110 | — |
| Service classes | 62 | 10+ feature API services |
| Repository interface/impl pairs | 37 | — |
| Form-request validators | 84 | reactive forms across features |
| API resources (transformers) | 64 | — |
| OpenAPI documented operations | 197 operations / 136 paths / 38 tags | — |
| Reusable UI components | — | 17 `nas-*` design-system components |
| Localization | API locale via `Accept-Language` (en/ar) | 1,213 translation keys × 2 locales (en/ar) with full RTL |

> Scope of this document: this is a project-closure / handover contribution report. Every statement below is grounded in files that exist in the two repositories at the time of analysis. Git history shows a single primary contributor authored ~94% of backend commits and 100% of frontend commits across a ~3-week intensive delivery window (2026-05-14 → 2026-06-02, branch `main`).

---

# My Contributions

## System Architecture

The architecture is a **clean, layered, contract-first design** that cleanly separates the new product from the frozen legacy system.

**Macro architecture — two repos, one backend:**

- **Standalone REST API** under `/api/v1` (prefix added in `bootstrap/app.php`, version group in `routes/api.php`). Domain route files are auto-discovered: `routes/api.php` globs every `routes/apis/*.php` file, so each business domain owns its own route module (40 of them) without a monolithic route file.
- **Angular SPA** consuming that API exclusively through a typed `ApiService` wrapper and per-feature API services, with a standard response envelope (`core/models/api-response.model.ts`).
- **Strict isolation from the legacy MVC layer** (per `SSOT.md`): the original Blade controllers (`AdminControllers/`, `FrontControllers/`) remain untouched; all new behavior is additive REST.

**Backend layering (request → response):**

```
Route (routes/apis/*.php)
  → Middleware (auth.user / role / mobile.token / language)
    → FormRequest (app/Http/Requests/** — 84 validators)
      → Controller (app/Http/Controllers/apis/** — thin orchestration)
        → Service (app/Services/** — 62 business-logic classes)
          → Repository interface (app/Repositories/Contracts/** — 37)
            → Eloquent Repository impl (app/Repositories/Eloquents/**)
              → Model (app/Models/** — 59)
        → API Resource (app/Http/Resources/** — 64 transformers)
```

**Key architectural patterns implemented:**

- **Repository pattern with dependency-inversion** — 37 contract/implementation pairs bound in `AppServiceProvider`, so services depend on interfaces (`CourseRepositoryInterface`, `Mobile\AcademyRepositoryInterface`, …) and the Eloquent implementation is swappable/testable.
- **Service layer** — all non-trivial business logic lives in services (`CourseService`, `CertificateService`, `Mobile\EnrolmentService`, `DashboardPasscodeService`, …), keeping controllers thin.
- **API Resource transformers** — 64 resources guarantee a stable, documented JSON contract decoupled from DB schema (e.g. `CourseResource`, `SessionPasscodeStateResource`, `Mobile/AcademyCourseCardResource`).
- **Settings-as-configuration** — every tunable threshold is a row in the `settings` table read through a typed accessor (`Mobile\MobileSettings`), so platform behavior is reconfigurable without a deploy.
- **Enum registry** — a single `EnumRegistry` exposes 19 localized dropdown vocabularies to the frontend via `/api/v1/enums/{name}`, eliminating duplicated option lists between FE and BE.

**Frontend architecture:**

- **Angular 18 standalone components** (no `NgModule`s) with **lazy routing** (`loadComponent`/`loadChildren`) per feature.
- **Signals-first reactivity** — `signal()`/`computed()`/`toSignal()` for component state; `ChangeDetectionStrategy.OnPush` on 54 components for predictable, performant change detection.
- **NAS design system** — 17 reusable `nas-*` components (`shared/nas/`) plus a CSS custom-property token system in `styles.scss`, giving a single source of visual truth.
- **Cross-cutting concerns as HTTP interceptors** (locale → auth → error) and **route guards** (`authGuard`, `guestGuard`, `permissionGuard`).

## Dashboard Development

The admin **dashboard** (`features/dashboard/pages/admin-dashboard`) is a fully server-driven control center — nothing is fabricated client-side.

**Implemented dashboard capabilities:**

- **Personalized greeting** — time-of-day greeting (`good_morning`/`good_afternoon`/`good_evening`) bound to the actual logged-in administrator's name from `AuthService.currentAdmin()` (replacing a previously hard-coded "Admin" label), with the live localized date.
- **KPI stat cards** (4) — Active Learners (with online/offline sub-pills and month-over-month delta), Active Courses, Average Completion (`org_compliance_percent`), and Instructors count — rendered via the reusable `nas-stat-card`, fed by `GET /api/v1/dashboard`.
- **Enrollment & Completion trend chart** — a PrimeNG line chart fed from server-computed buckets (`enrollment_trend`), with **Week / Month / Quarter / Year** range tabs (driven by the `dashboard_range` enum → `?range=` query) and a genuine empty-state. The chart was made full-width per design feedback.
- **Notifications preview** — the latest two platform notifications with localized title/body and relative timestamps, plus a **View All** action that opens the global notifications drawer.
- **Top Enrolled Courses table** — course, instructor, enrolled count, completion progress bar (`nas-progress`), status badge (`nas-status-badge`), and drill-through to course detail.
- **Instructor Live-Passcode widget** (`components/passcode-widget`) — a complete attendance-control surface embedded in the dashboard header (detailed under *Business Logic*).
- **Skeleton loading states** for every async region.

**Supporting management screens delivered across the dashboard product (25 feature areas)** include: Courses (list + rich detail with cohort/learners/content/qualifications/ratings tabs and a cohort-attendance drawer), Categories, Resources, Users (unified admins/instructors/learners), Assignments, Quizzes, Ratings, Inbox/Messages, Certificates, Job Titles, Qualifications, Roles, Controllers, Reports, Audit Log, and Platform Settings — each with list/filter/search, create/edit dialogs or routes, and confirm-delete flows.

## Backend APIs

All endpoints are versioned under `/api/v1`, return a consistent `{ status, message, result, meta }` envelope, and are documented in OpenAPI. Grouped by business domain:

### Authentication APIs
- **Purpose:** Separate, secure login for the two personas (back-office `Admin` and learner `User`).
- **Endpoints:** `POST auth/user/login|logout|logout-all`, `GET auth/user/me`, `PUT auth/user/profile`; `POST auth/admin/login|logout`, `GET auth/admin/me`, `PUT auth/admin/profile` (`AuthController`).
- **Business value:** Single, auditable identity surface for web and integrations.
- **Technical:** Laravel Sanctum personal-access tokens (`HasApiTokens`), `UserAuthService`/`AdminAuthService` for token issuance, `logout-all` for full session revocation.

### User & Admin Management APIs
- **Purpose:** Manage the unified people directory — learners, instructors, and admin accounts.
- **Endpoints:** legacy `users` CRUD + `users/search`; modern `admin/users/*` (summary, filter-options, `{source}/{id}`, **reactivate**), `admin/controllers/*`, `admins` CRUD (`Admin\AdminUserController`, `AdminController`).
- **Business value:** One screen to administer all personas; deactivated users can be **reactivated** without re-creation.
- **Technical:** Multi-source aggregation (users/instructors/admins), avatar upload, status lifecycle (`active|inactive|deactivated`), Spatie-role assignment.

### Course & Catalogue APIs
- **Purpose:** Full lifecycle of courses, cohorts (sections), modules/lectures, and offline sessions.
- **Endpoints:** `courses` (+ `tab-counts`, `{course}`) CRUD; `courses/{course}/sections` (cohort CRUD + sync); `courses/{course}/lectures|modules` (+ `upload`); `courses/{course}/exams`; `courses/{course}/sessions` (offline); enrollment endpoints.
- **Business value:** A single course supports online, offline, hybrid, and external-link delivery, multiple cohorts, and module-level learner scoping.
- **Technical:** `CourseService`/`CourseSectionService`/`CourseLectureService`/`CourseSessionService` over repositories; translatable fields (en/ar); derived course/cohort status; tab counts computed server-side.

### Attendance APIs
- **Purpose:** Record and report attendance for offline/live sessions.
- **Endpoints:** `GET/POST attendance`; `GET courses/{course}/cohorts/{cohort}/attendance` (matrix drawer); `GET courses/{course}/my-attendance` (`AttendanceController`, `CohortAttendanceController`).
- **Business value:** A per-cohort attendance matrix for coordinators and a learner self-view; powers compliance reporting.
- **Technical:** `AttendanceService`/`CohortAttendanceService`; denormalized course/section/session columns with a composite index for fast cohort/session lookups; full audit trail via `attendance_logs`.

### Certificate APIs
- **Purpose:** Issue, list, download, and revoke verifiable completion certificates.
- **Endpoints:** legacy `certificates` (+ `{courseId}`); admin `admin/certificates` (+ `template/*`, `{certificate}/download`, `revoke`, `{userId}/{courseId}/download`) (`CertificateController`, `Admin\AdminCertificateController`).
- **Business value:** Certificates are first-class, uniquely numbered, status-tracked, and verifiable — not derived on the fly.
- **Technical:** A dedicated `user_certificates` entity with `uuid`, `certificate_number`, `status`, and provenance (`source_type/id`); admin-uploaded `certificate_templates`; configurable award basis (attendance / score / both) via settings; a backfill command for historical completions.

### Exam / Quiz APIs
- **Purpose:** Author rich quizzes (MCQ, yes/no, open, reorder), scope them to cohorts, capture attempts, and grade.
- **Endpoints:** legacy `quizzes` (+ `{userExam}`); modern `admin/quizzes/*` (summary, list, cohorts, instructors, submissions, grade, CRUD) (`QuizController`, `Admin\AdminQuizController`).
- **Business value:** Configurable knowledge checks tied to cohorts with manual + auto grading.
- **Technical:** `course_exams`/`course_exam_questions`/`course_exam_question_answers`/`course_exam_cohorts`; attempts in `user_exams`/`user_exam_answers`; rich-grading migrations; `UserExamService`/`Admin\AdminQuizService`.

### Assignment APIs
- **Purpose:** File-based and question-based assignments with submissions and review.
- **Endpoints:** legacy course-scoped assignment CRUD + submit/review; modern `admin/assignments/*` (`CourseAssignmentController`, `Admin\AdminAssignmentController`).
- **Business value:** Graded deliverables with due dates and cohort scoping.
- **Technical:** `course_assignments`/`_questions`/`_cohorts`, submissions in `user_course_assignments`/`_answers`, rich-scoring migrations.

### Evaluation & Rating APIs
- **Purpose:** Post-course evaluations (templated) and course ratings/feedback.
- **Endpoints:** `evaluation-categories`, `evaluations` CRUD; learner `courses/{course}/evaluate`; ratings `courses/{course}/ratings` + admin `admin/ratings/*` (summary, filter-options).
- **Business value:** Structured quality signal on courses and instructors; abnormal-rating alerting threshold is configurable.
- **Technical:** `EvaluationCrudService`/`UserCourseEvaluationService`/`CourseRatingService`/`Admin\AdminRatingService`; nullable rating comments (2026 migration).

### Reporting APIs
- **Purpose:** Workforce compliance and performance reporting with exports.
- **Endpoints:** legacy `reports/*` (compliance-by-job-title, individual-compliance, attendance, completion, scores, certificate-status); modern `admin/reports/*` (summary, compliance-preview, export-all, `{type}/export`).
- **Business value:** Management-grade visibility into training compliance, attendance, completion, and scoring, exportable to CSV/XLSX.
- **Technical:** `Admin\AdminReportService`; export history persisted in `report_export_logs`.

### Platform / Reference APIs
- **Settings** (`settings`, `admin/settings` + `upload`), **Enums** (`enums`, `enums/{name}`), **Notifications** (`notifications`), **Inbox/Messages** (`messages` + `read`), **Audit Log** (`audit-log`, `admin/audit-log` + export), **Roles/Permissions** (`roles`, `admin/roles`), **Job Titles**, **Qualification Skills**, **Categories**, **Instructors**, **LMS Resources**, **CMS/Articles**, **Forms**, **Lecture Q&A**, and learner self-service **`/my/*`** (dashboard, courses, exams, assignments, certificates, ratings, progress, evaluations, forms).

## Mobile Application Support

A purpose-built, server-to-server **mobile API** powers the NAS Employee app's S-01 → S-07 journey (`routes/apis/mobile.php`), backed by dedicated mobile services, repositories, resources, and a configuration layer.

**Endpoints (15 learner endpoints under `/api/v1/mobile/*`, all HR-authenticated):**

| Screen | Endpoint(s) |
| --- | --- |
| Identity | `GET mobile/me` |
| Academy (S-01–S-04) | `academy/summary`, `academy/scopes`, `academy/courses`, `academy/courses/{course}`, `POST academy/courses/{course}/enrol` |
| My Learning (S-05) | `my-learning/overview`, `/active`, `/qualifications`, `courses/{course}/sessions` |
| Attendance (S-06) | `POST attendance/mark` |
| Ratings | `POST my-learning/courses/{course}/rating` |
| Certificates (S-07) | `my-learning/certificates`, `certificates/{id}`, `certificates/{id}/download` |

Plus **2 admin passcode endpoints** (`POST/DELETE admin/course-sessions/{session}/passcode`) that power the mobile attendance flow.

**Mobile backend logic implemented:**

- **`AcademyService`** — catalogue discovery: scope chips, paginated catalog, course detail with a computed CTA state (`enrol_now`, `get_notified`, `enrolled_view_learning`, `unavailable`, `not_enrollable`), and "anchor cohort" resolution.
- **`EnrolmentService`** — first-come-first-served enrolment as a DB transaction with cohort row-locking, capacity checks, and enrolment-deadline enforcement; typed outcomes (`enrolled`, `already_enrolled`, `cohort_full`, `enrolment_closed`, `no_cohort`).
- **`MyLearningService`** — active courses (preview + paginated), per-course session attendance rows, and progress.
- **`QualificationProgressService`** — qualification chips derived from the job-title ↔ course-qualification graph.
- **`MobileAttendanceService`** — the S-06 mark-present validation chain with typed failures (`invalid_code`, `expired_code`, `no_open_window`, `already_marked`, `not_enrolled`).
- **`SessionPasscodeService`** — numeric passcode issuance/rotation with static-vs-rotating expiry driven by settings.
- **`MobileCertificateService`** / **`MobileRatingService`** — certificate detail/download and cohort rating upsert.

**Mobile configuration (21 tunable keys + a security token)** via `MobileSettings`/`MobileSettingSeeder`, grouped into `mobile_academy`, `mobile_my_learning`, `mobile_attendance`, `mobile_rating`, `mobile_security` — page sizes, preview counts, deadline warning/critical days, scheduled-cohort visibility window, passcode length/window/buffers, static-vs-rotating passcode mode and reset interval, rating scale, and the shared bearer token. Reads are cached (`mobile.settings.map`, 10-minute TTL) and cache-busted on settings save.

**Mobile validation harness (Angular `/test-mobile` sandbox):** an isolated, deletable tooling app that mirrors the 15-endpoint contract (`core/endpoints.ts`) and provides a phone-frame **preview** (Academy / Course detail / My Learning screens), a per-endpoint **tester**, a non-mutating **journey runner**, a **config** page (base URL, shared token, employee code, locale), and exportable request/response **logs** — enabling end-to-end mobile-contract verification without Postman.

## Authentication & Authorization

**Login flow:** Persona-specific login (`auth/user/*`, `auth/admin/*`) issuing Sanctum tokens; the Angular app stores the token, exposes it via an auth signal, bootstraps the session, and attaches it on every request.

**Token strategy:** **Laravel Sanctum** personal-access tokens (`personal_access_tokens` table) on both `User` and `Admin` models (`HasApiTokens`). `logout-all` revokes every token for a principal.

**Guards & middleware (backend):**
- `auth.user` (`AuthenticationMiddleware`) — Sanctum bearer validation for API.
- `role:Admin|User` (`RoleMiddleware`) — gates routes by principal model type.
- `permission` / `role_or_permission` — Spatie permission middleware.
- `mobile.token` (`VerifyMobileSharedTokenMiddleware`) + `mobile.employee` (`ResolveMobileEmployeeMiddleware`) — the S2S mobile auth pair.
- `language` (`SetLocale`), `api-protect` (webhook secret), `admin.logs` (action logging).

**Mobile authentication (S2S):** a shared bearer token (accepted via `X-Api-Token`, `X-Mobile-Token`, or `Authorization: Bearer`, compared with `hash_equals` against a settings-stored secret) **plus** employee identity resolved from an `Employee-Code` header against `users.machine_code`, injected as the request user — giving services a Sanctum-like contract without per-user mobile credentials. Failure modes are explicit: 401 (bad token), 422 (missing code), 404 (unknown employee).

**Role & permission management:** **Spatie Laravel Permission** (`roles`, `permissions`, `model_has_roles`, …) with both a legacy roles surface and a modern `admin/roles` UI; the Angular side enforces a **view-key permission model** — every admin route carries a `data.viewKey`, a `permissionGuard` checks it against the user's granted views, the sidebar is permission-filtered, and unauthorized users are redirected to their first allowed screen.

**Security enhancements:** server-side credential removal from version control (`Remove service account credentials` commit), constant-time token comparison for the mobile token, token rotation via settings without a deploy, and audit logging of admin actions (`audit_logs`, `AdminLogMiddleware`).

## Database Design

**110 migrations / 59 models.** Highlights of the data model designed/extended:

**New first-class entities & tables:**
- **`user_certificates`** — the certificate domain redesigned from a derived concept into a real entity: `uuid`, unique `certificate_number`, `status`, issuance provenance (`source_type`/`source_id`), FKs to user/course, with indexes on `(user_id, course_id)`, `(user_id, status)`, and a unique `certificate_number`.
- **`certificate_templates`** — admin-uploaded certificate artwork with auto-field metadata.
- **`audit_logs`** + `report_export_logs` — platform audit trail and export history.
- **`lms_resources`**, **`admin_messages`/`admin_message_recipients`** (inbox), **`job_titles`** + `job_title_qualification_skill`, **`qualification_skills`** + `course_qualification_skills`.
- Rich **assessment** tables: `course_exam_*` / `user_exam_*` and `course_assignment_*` / `user_course_assignment_*`, including cohort-scope pivots.

**Key relationships:**
- `Course` ↔ `User` many-to-many via `users_courses` (carrying a nullable `group_id` → cohort), with a unique `(course_id, user_id)` constraint.
- `Course` → `CourseSection` (cohorts) → `CourseSession` (meetings); `Course` → `CourseLecture` (modules) scoped to all-learners or a specific cohort.
- `Course` ↔ `Instructor` via `courses_instructors`.
- `Attendance` → nullable `session_id`, with `AttendanceLog` audit children.

**Constraints, indexes & decisions:**
- **Cohort metadata** added to `course_sections`: `start_date`, `end_date`, `capacity`, `status`, and `avg_session_time` (per-cohort attendance-window length).
- **Performance indexes** migration targeting hot query paths: `courses` (`active`, `course_type`, `category_id`), `users` (`learner_type`, `name`, `machine_code`, `department_name`), `course_sessions.course_id`, and a composite `attendances (course_id, section_id, session_id)`.
- **Settings-driven config** in `settings` (key/value/type/module) instead of hard-coded constants.
- Foreign-key cascades on enrolment; nullable `course_ratings.comment`; `session_id` added to `attendances`.
- No soft-deletes — lifecycle handled via explicit status columns and enums.

## Business Logic

**Learning journey (mobile):** discover (Academy summary → scopes → catalog → detail with computed CTA) → **enrol** (FCFS, transactional, capacity- and deadline-aware) → *My Learning* (active courses, sessions, qualifications) → attend → rate → earn certificate.

**Enrolment process:** `EnrolmentService` runs the enrolment inside a DB transaction, locks the target cohort row, validates capacity and the enrolment-close window (configurable offset before cohort start), and returns a typed outcome consumed by the mobile CTA.

**Cohort visibility & status workflow:** a cohort status vocabulary (`scheduled`, `open_for_enrollment`, `active`, `completed`, `inactive`) with a deliberate visibility gate — `scheduled` cohorts surface in the Academy a configurable number of days before start (default 30 ≈ one month), while `open_for_enrollment` cohorts appear immediately. `active`/`completed` are derived from dates; a scheduled command (`cohorts:sync-statuses`, daily 00:05) rolls statuses automatically.

**Attendance workflow (passcode):** an instructor starts a live session from the dashboard; a numeric passcode is issued. Two modes (set in platform settings):
- **Static** ("Course Attendance = Yes") — one passcode valid for the whole session window.
- **Rotating** ("Course Attendance = No") — the passcode **auto-regenerates every `passcode_reset_seconds`** with zero user action (the dashboard widget counts down and re-issues silently), and an **End Session** button revokes the code and closes the window.
Learners mark present (S-06) only inside the open window with the current valid code; the mark-present chain enforces enrolment, the time window, code validity, and duplicate prevention.

**Course completion & certification:** completion is evaluated against a configurable basis (attendance / score / both, with a minimum passing score); on satisfaction a uniquely numbered `user_certificate` is issued, downloadable and revocable, and verifiable by number/UUID. A backfill command migrated historical completions into the new entity.

**Assessment workflows:** quizzes and assignments support cohort scoping, multiple question types, learner submission, and admin grading (manual + automatic), feeding scores into completion and reporting.

## Performance Improvements

- **Targeted database indexing** — a dedicated migration added indexes on the highest-traffic filter/sort columns (`courses.active/course_type/category_id`, `users.learner_type/name/machine_code/department_name`, `course_sessions.course_id`) plus a composite `attendances (course_id, section_id, session_id)` index for the cohort-attendance matrix.
- **Settings caching** — `MobileSettings` memoizes the full `mobile_*` map in cache (10-minute TTL) and per-request, so high-frequency mobile reads avoid repeated SQL; the cache is invalidated on settings save.
- **Server-computed aggregates** — dashboard KPIs, enrollment/completion trend buckets, and course tab-counts are computed in the query/service layer rather than over-fetching and aggregating on the client.
- **Repository-scoped queries** — list endpoints push filtering, pagination, and existence checks into repositories (e.g. the academy availability/visibility gates) instead of loading-then-filtering in PHP.
- **Frontend rendering performance** — `ChangeDetectionStrategy.OnPush` on 54 components, signals/`computed` for fine-grained reactivity, lazy-loaded feature routes, debounced search inputs, and `shareReplay`-cached enum lookups.

## Refactoring & Code Quality

- **Legacy → API migration discipline** — new capability is delivered as additive REST modules without touching the frozen MVC layer, governed by `SSOT.md`; many domains have a clean "2026" `Admin\*` controller/service replacing legacy equivalents (users, roles, quizzes, assignments, ratings, reports, audit log, certificates).
- **Certificate domain redesign** — moved from a fragile derived concept to a first-class `UserCertificate` entity with its own repository, service, resources, and migration, eliminating recomputation and ambiguity.
- **API surface clean-up** — removed the redundant `/mobile/academy/categories` endpoint in favor of the richer `/mobile/academy/scopes`, keeping the mobile contract minimal and intentional.
- **Reusable design system** — 17 `nas-*` components plus a tokenized SCSS theme remove UI duplication; global fixes (required-field markers, sticky dialog CTAs, save-disabled-until-dirty, dropdown overlay clipping) were applied once at the system level rather than per-screen.
- **Shared utilities** — `course-mapper` (DTO→UI mapping), `withLocaleReload` (locale-aware data refetch), `pickLocalized` (en/ar selection) standardize cross-cutting frontend behavior.
- **Consistent contracts** — a uniform response envelope, 64 API resources, 84 form-request validators, and an enum registry standardize request/response shapes and validation across the whole API.

## Swagger & API Documentation

- **OpenAPI 3.0 via L5-Swagger** — the API is annotated with `@OA\*` and published as a generated spec (`storage/api-docs/api-docs.json`, plus `openapi.yaml`), served through Swagger UI at **`/api/documentation`** with the raw spec at `/docs`.
- **Documented scale:** **197 operations across 136 paths**, organized into **38 tags** (sidebar groups) defined centrally in `app/OpenApi/Info.php`, with the server pinned to `/api/v1`.
- **Reusable documentation components** — shared parameters/schemas (`MobileAuthorization` for `X-Api-Token`, `EmployeeCode`, `AcceptLanguage`, success/error envelopes) in `app/OpenApi/Schemas/Envelopes.php`, so every endpoint references one canonical contract.
- **Mobile documentation** — all 15 mobile endpoints are tagged under a single **`Mobile`** group with screen identifiers (`📱 [MOBILE · S-02]`) in summaries; the admin passcode endpoints are documented under their own tag with `BearerAuth`.
- **Request/response standardization** — a consistent `{ status, message, result, meta }` envelope and per-resource transformers make every response predictable and self-describing.

> Documentation also lives as in-repo guides (`NAS-MOBILE_API_GUIDE.md`, `NAS-LMS-Mobile-UX-Business.md`, `project.md`, `SSOT.md`, `NAS_DesignSystem.md`, `mobile-sandbox.md`). No Postman collection is maintained — Swagger UI plus the `/test-mobile` sandbox and feature tests serve that role.

## Challenges Solved

**1. Certificate domain was derived, not real.**
- *Problem:* Certificates were computed on the fly, making them impossible to number uniquely, revoke, or verify reliably.
- *Solution:* Designed a first-class `user_certificates` entity (uuid, certificate number, status, provenance), repository/service/resources, a migration, and a backfill command for historical data.
- *Impact:* Verifiable, revocable, auditable certificates and a stable mobile S-07 contract.

**2. Mobile attendance silently failed (`TIMESTAMPDIFF` on TIME columns).**
- *Problem:* Live-session lookups compared `TIME` columns using `TIMESTAMPDIFF`, which returns `NULL` for time-only values, so "live now" sessions were never found and learners couldn't mark attendance.
- *Solution:* Replaced the arithmetic with direct clock comparisons using `ADDTIME`/`SUBTIME` across `MyLearningService`, `DashboardPasscodeService`, and `MobileAttendanceRepository`.
- *Impact:* Attendance marking and the live-session window now work reliably.

**3. Module creation 422 (`session_id` vs `section_id` confusion).**
- *Problem:* Creating a module scoped to a "specific cohort" sent the `course_sections.id` in a field validated against `course_sessions.id`, producing a 422.
- *Solution:* Corrected the `CourseLectureRequest` rule to validate the cohort id against `course_sections` scoped to the route's course.
- *Impact:* Cohort-scoped modules can be created without spurious validation errors.

**4. Rotating passcode that never rotated / mis-read settings.**
- *Problem:* The "passcode resets each N seconds" requirement wasn't wired end-to-end; an expired-but-still-running session was wrongly shown as "ended", and the reset settings were stored under the wrong module so the backend fell back to static/30s defaults.
- *Solution:* Implemented mode-aware expiry (static window vs rotating interval), a `startedLiveSession` concept (a started session stays live for its whole window), silent auto-rotation, an **End Session** action, a self-heal that realigns stale long-lived codes to the rotation interval, and corrected the settings module + cache invalidation. Covered by 10 feature tests.
- *Impact:* Passcodes now rotate automatically per the configured interval and only end on explicit instructor action.

**5. Dropdowns clipped inside scrolling containers.**
- *Problem:* PrimeNG dropdown panels were clipped/hidden under parent containers across the app.
- *Solution:* Standardized `appendTo="body"` on dropdown overlays platform-wide.
- *Impact:* Consistent, unclipped overlays everywhere.

**6. Localization gaps & inaccurate Arabic strings.**
- *Problem:* Missing English strings and an inaccurate Arabic enrolment label; data lists didn't refetch on language switch.
- *Solution:* Completed the 1,213-key bilingual dictionaries, corrected copy, and applied the `withLocaleReload` pattern so localized server data refreshes on locale change.
- *Impact:* Accurate, fully bilingual (en/ar) UI with correct RTL behavior.

**7. Course "cohorts count" showed 0 and new courses didn't appear on mobile.**
- *Problem:* The admin cohort count aggregated the wrong table, and a default close-offset hid newly-added courses from the Academy.
- *Solution:* Corrected the `withCount` aggregation and made the visibility/close-offset windows configurable settings (including a scheduled-cohort visibility window).
- *Impact:* Accurate cohort counts and predictable Academy visibility.

## Key Achievements

- Delivered a complete, standalone **REST API (Laravel 11)** of ~220+ versioned endpoints powering both a web dashboard and a mobile app.
- Architected a clean **layered backend** — 62 services, 37 repository contract/impl pairs, 84 validators, 64 API resources — with strict isolation from the frozen legacy MVC system.
- Built a modern **Angular 18 admin dashboard** (25 feature areas, signals, standalone components, OnPush) on a reusable 17-component **NAS design system**.
- Implemented a secure dual-persona **authentication & RBAC** system (Sanctum + Spatie) with a view-key permission model and a hardened **server-to-server mobile auth** (shared token + employee-code identity).
- Designed and shipped a first-class **certificate domain** (issue / number / verify / revoke) with templates and historical backfill.
- Delivered the full **employee mobile journey** (Academy → enrol → My Learning → attendance → rating → certificate) as 15 documented S2S endpoints with 21 settings-driven, reconfigurable thresholds.
- Engineered an **auto-rotating live-attendance passcode** with static/rotating modes, silent auto-regeneration, and explicit session-end control — fully tested.
- Standardized **API documentation** with OpenAPI/Swagger (197 operations, 136 paths, 38 tags) and shared request/response contracts.
- Built a fully **bilingual (English/Arabic) RTL** experience across 1,213 translation keys, backed by an enum registry shared between frontend and backend.
- Tuned **performance** via targeted indexing, settings caching, and server-side aggregation; raised maintainability via modular refactoring and a reusable design system.

## Quantifiable Impact

- **API throughput of delivery:** ~220+ endpoints across 40 domain modules; 197 documented OpenAPI operations — a complete, discoverable contract for two client products.
- **Maintainability:** 62 single-responsibility services + 37 repository abstractions decouple business logic from data access, making behavior testable and storage swappable; 64 resources + a uniform envelope guarantee consistent responses.
- **Configurability without redeploys:** 21+ mobile thresholds (page sizes, deadlines, visibility windows, passcode mode/interval) and platform settings are DB-driven, so operations can re-tune behavior live.
- **Reliability:** critical correctness fixes (attendance time-window math, passcode rotation, cohort counts, module scoping) eliminated user-blocking defects; the passcode/attendance domain alone is guarded by 10 automated feature tests (plus the existing mobile attendance suite).
- **Performance:** hot-path indexing and a 10-minute settings cache reduce repeated query cost on the busiest mobile and dashboard reads; OnPush + lazy routing keep the SPA responsive (initial bundle within a 1 MB budget).
- **Consistency & UX:** one design system (17 components) + global fixes (overlay clipping, sticky CTAs, dirty-state save guards) applied once instead of per screen; full en/ar localization with RTL broadens accessibility to the entire workforce.
- **Verifiability & governance:** Figma node-ID traceability embedded in code across both repos, a shared `SSOT.md` contract, and Swagger UI + a dedicated `/test-mobile` sandbox provide auditable design-to-code and API verification paths.
