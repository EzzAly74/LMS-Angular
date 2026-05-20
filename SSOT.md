# NAS LMS — Single Source of Truth (SSOT)

> This document is the authoritative reference for all design, development, and product decisions.
> Every implementation must align with what is written here.
> Last updated: 2026-05-20

---

## ⚠️ AI Agent Rules — Read Before Doing Anything

> **These rules are non-negotiable. Follow them exactly before writing a single line of code.**

### 🚫 Rule 1 — Never touch the MVC (Laravel Blade app)

The existing Laravel application (`routes/web.php`, all controllers, all Blade views, `app.css`, and all frontend assets) is **complete and frozen**.

- Do **not** edit, refactor, delete, or "improve" any existing file in the MVC layer.
- Do **not** add new Blade views, routes in `routes/web.php`, or controller methods to existing controllers.
- Do **not** touch the design system, CSS tokens, or utility classes in `resources/css/app.css`.
- If something in the MVC looks incomplete or wrong — **leave it**. It is out of scope.

The only valid reason to open an MVC file is to **read** it and understand existing data structures.

---

### ✅ Rule 2 — API-only work (your actual job)

Your job is to build a **separate, standalone REST API** that the Angular frontend will consume. All new backend work lives here.

**What this means in practice:**
- Create new API routes in `routes/api.php` only.
- Create new API controllers in `app/Http/Controllers/Api/` — never touch existing controllers in `app/Http/Controllers/`.
- Create Eloquent models, migrations, seeders, and resources as needed for the API.
- Use `spatie/laravel-permission` (already installed) for role-based access control — see the SKILL.md for correct usage patterns.
- Return JSON responses only. No Blade, no redirects, no session-based auth — use Sanctum tokens.
- Follow RESTful conventions: `GET /api/v1/courses`, `POST /api/v1/courses`, etc.
- Prefix all API routes with `/api/v1/`.

**Never mix API logic into the MVC layer. They are two separate systems.**

---

### 🚫 Rule 3 — No Angular work (do not scaffold the frontend)

- Do **not** run `ng new`, `npm create`, or any command that scaffolds an Angular project.
- Do **not** create any `.ts`, `.html` (Angular templates), `.scss`, or Angular-specific config files.
- Do **not** install Angular or any Angular-related npm packages.

The Angular project will be set up separately by the human. Your job ends at the API layer.

After APIs are complete, the human will:
1. Scaffold the Angular project structure manually.
2. Install required libraries.
3. Provide a Figma design file.
4. Ask you to use the Figma MCP server to generate Angular components based on the design and wire them to the APIs you built.

---

### ✅ Rule 4 — API completion checklist (before declaring done)

Before saying the API work is done, verify:
- [ ] All endpoints needed by Admin, Instructor, and Learner roles are implemented (cross-reference §8 and §9).
- [ ] Authentication via Laravel Sanctum (`POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`).
- [ ] Role-based middleware applied to every protected route (`role:admin`, `role:instructor`, `role:learner`).
- [ ] All responses use API Resources (`app/Http/Resources/`) for consistent JSON shape.
- [ ] Validation via Form Requests (`app/Http/Requests/`).
- [ ] Migrations created for every model.
- [ ] Seeder with realistic demo data reflecting the demo data described in §14.
- [ ] `routes/api.php` is clean, grouped by role/feature, and commented.

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Tech Stack](#2-tech-stack)
3. [Design System](#3-design-system)
4. [Logo Usage](#4-logo-usage)
5. [Roles & Permissions](#5-roles--permissions)
6. [Business Architecture](#6-business-architecture)
7. [Feature Specifications](#7-feature-specifications)
8. [Dashboard Sections — Per Role](#8-dashboard-sections--per-role)
9. [Navigation Structure — Per Role](#9-navigation-structure--per-role)
10. [UX Rules](#10-ux-rules)
11. [Alert System](#11-alert-system)
12. [Component Inventory](#12-component-inventory)
13. [Implementation Status](#13-implementation-status)
14. [Demo Data & Dev Patterns](#14-demo-data--dev-patterns)

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Product name** | NAS LMS |
| **Description** | Corporate Learning Management System for managing employee qualifications, course delivery, and compliance tracking |
| **Platform** | Web dashboard (Admin + Instructor only) · Website + Mobile app (Learner) |
| **Languages** | English (LTR) + Arabic (RTL) — both first-class |
| **Mode** | Light mode only |
| **Audience** | Single organisation (not multi-tenant SaaS) |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Laravel 13 (PHP 8.4) |
| Database | SQLite (dev) → MySQL/PostgreSQL (prod) |
| Frontend | Blade templates + Tailwind CSS v4 + Alpine.js 3 |
| Charts | Chart.js 4 |
| Build | Vite 8 + laravel-vite-plugin |
| Fonts | Fira Sans (English) · Almarai (Arabic) via Google Fonts |

**Dev servers:**
- Laravel: `http://127.0.0.1:8010` (persistent, run with `php artisan serve --port=8010`)
- Vite: port 5174

**Key files:**
- Layout shell: `resources/views/components/layouts/app.blade.php`
- CSS tokens: `resources/css/app.css`
- Routes: `routes/web.php`
- SSOT (this file): `docs/SSOT.md`

---

## 3. Design System

All tokens are defined as CSS custom properties in `resources/css/app.css`.
**Never use hardcoded hex values. Always reference tokens.**

> **Inline style note:** Tailwind v4 utility classes do not auto-map to the NAS token scale.
> Until a custom Tailwind plugin is added, using `style="color: var(--token)"` inside Blade/Alpine
> is the correct approach for token-based values. This is not an exception — it is the current pattern.

### 3.1 Color — Primitive

```
Deep Teal (primary brand)
  --color-deep-teal-100 → #F2FBFA
  --color-deep-teal-200 → #D5F2F0
  --color-deep-teal-300 → #AAE5E1
  --color-deep-teal-400 → #78D0CE
  --color-deep-teal-500 → #4CB4B5
  --color-deep-teal-600 → #339699
  --color-deep-teal-700 → #26787B
  --color-deep-teal-800 → #225F63
  --color-deep-teal-900 → #1F4C50
  --color-deep-teal-950 → #1E4043
  --color-deep-teal-1000 → #0C2427

Accent Sky
  --color-accent-sky-400 → #75DEFF
  --color-accent-sky-500 → #69C8E6
  --color-accent-sky-600 → #5EB2CC

Grey Neutral
  --color-grey-0   → #FFFFFF
  --color-grey-50  → #FAFAFA
  --color-grey-100 → #FFFBF7
  --color-grey-200 → #F0F0F0
  --color-grey-300 → #F5F5F5
  --color-grey-400 → #E6E7E8
  --color-grey-500 → #CFD0D1
  --color-grey-700 → #8C8C8C
  --color-grey-750 → #676E76
  --color-grey-800 → #595959
  --color-grey-900 → #454545
  --color-grey-1000 → #171819

Status
  --color-status-green-50   → #E7F8F0    --color-status-green-500  → #0FB86A    --color-status-green-600  → #0DA35F
  --color-status-orange-50  → #FEF4E6    --color-status-orange-500 → #F79008
  --color-status-red-50     → #FEECEB    --color-status-red-200    → #FAC5C1    --color-status-red-500    → #F14437    --color-status-red-600    → #D93C30
```

### 3.2 Color — Semantic

```
Surfaces
  --surface-bg      → var(--color-grey-50)        Page background
  --surface-card    → var(--color-grey-0)          Card background
  --surface-sidebar → var(--color-deep-teal-1000)  Sidebar
  --surface-header  → var(--color-deep-teal-950)   Top header bar

Text
  --text-primary   → var(--color-grey-1000)
  --text-secondary → var(--color-grey-750)
  --text-disabled  → var(--color-grey-700)
  --text-inverse   → var(--color-grey-0)
  --text-brand     → var(--color-deep-teal-700)

Interactive
  --interactive-primary        → var(--color-deep-teal-600)
  --interactive-primary-hover  → var(--color-deep-teal-700)
  --interactive-primary-active → var(--color-deep-teal-800)

Border
  --border-default → var(--color-grey-400)
  --border-focus   → var(--color-deep-teal-500)
```

### 3.3 Typography

| Token | Value |
|---|---|
| `--font-english` | 'Fira Sans', sans-serif |
| `--font-arabic` | 'Almarai', sans-serif |
| `--font-size-2XS` | 12px |
| `--font-size-XS` | 14px |
| `--font-size-S` | 16px |
| `--font-size-M` | 18px |
| `--font-size-L` | 20px |
| `--font-size-XL` | 24px |
| `--font-size-2XL` | 32px |
| `--font-size-Button-S` | 12px |
| `--font-size-Button-M` | 14px |
| `--font-size-Button-L` | 16px |

### 3.4 Spacing Scale

31 tokens from `--spacing-17XS: 2px` → `--spacing-12XL: 64px` (increments of 2px).

Key values: 8px · 12px · 16px · 24px · 32px · 40px

### 3.5 Border Radius

```
--radius-control-xs   → 4px     chips, tiny elements
--radius-control-sm   → 8px     inputs
--radius-control-md   → 12px    buttons, nav items
--radius-control-lg   → 16px    cards
--radius-container-sm → 12px
--radius-container-md → 16px
--radius-container-lg → 18px
--radius-container-xl → 20px
--radius-dialog       → 20px
--radius-pill         → 9999px  badges, tags
```

### 3.6 Shadows

```
--shadow-none → 0px 0px 0px 0px rgba(12,36,39,0)
--shadow-sm   → 0px 1px 2px 0px rgba(12,36,39,0.08)
--shadow-md   → 0px 2px 8px + 0px 0px 1px rgba(12,36,39,...)
--shadow-lg   → 0px 4px 16px + 0px 0px 2px rgba(12,36,39,...)
--shadow-xl   → 0px 8px 32px + 0px 0px 4px rgba(12,36,39,...)
```

### 3.7 Pre-built Utility Classes

| Class | Purpose |
|---|---|
| `.nas-card` | White card with border + shadow-sm |
| `.nav-item` | Sidebar nav link (default / hover / active states) |
| `.nav-group-label` | Sidebar section label |
| `.sidebar-tooltip` | Tooltip shown in icon-only sidebar state |
| `.badge` | Base badge (pill shape) |
| `.badge-green` `.badge-orange` `.badge-red` `.badge-teal` `.badge-grey` | Status badge variants |
| `.btn-primary` | Primary CTA button |
| `.btn-secondary` | Secondary outline button |
| `.nas-input` | Form input / select / textarea |
| `.nas-label` | Form label |
| `.nas-error` | Field error message |

---

## 4. Logo Usage

| Variant | File | Use when |
|---|---|---|
| **Primary** | `/Downloads/Variant=Primary.svg` | Light backgrounds (content area, cards, auth page) |
| **Secondary** | `/Downloads/Variant=Secondary.svg` | Dark backgrounds (sidebar `#0C2427`, header `#1E4043`) |
| **Icon only** | `/Downloads/Variant=Core Icon, Color=Accent Sky, BG=Yes.svg` | Favicon · collapsed sidebar · small spaces |

- Never place the logo on a background with insufficient contrast
- Minimum size: 24px height for icon-only, 80px width for full wordmark
- Do not recolour, stretch, or add effects to the logo

---

## 5. Roles & Permissions

Three roles. No Super Admin — Admin has full platform permissions.

### Admin
Full access to all platform features:
- Manage Job Titles (assign qualifications to fixed title list)
- Create / manage Qualifications (EN + AR name only)
- Create / manage / publish Courses (assign qualifications to courses)
- Manage Users (learners + instructors)
- Send direct Messages to learners and/or instructors
- Add / manage Resources (articles, links, files)
- View all Ratings (from learners to instructors)
- View all Assignments and Quizzes (view-only across all courses)
- View + export Reports
- Manage Categories, Certificate templates, Platform Config (About Us: description, mission, vision)
- View Audit Log
- Approve prerequisite exceptions (RPL)
- Review + publish instructor-built course content

### Instructor
Owns course delivery for assigned courses:
- Build course content (modules, sessions, assignments, quizzes, question bank)
- Add Resources linked to their courses
- Create new Cohorts within their courses
- Run live sessions (starts session → passcode generates)
- Grade assignments + add optional written feedback per learner
- Unlock quiz retake per individual learner
- Override attendance per learner
- Monitor student progress + analytics
- View ratings + feedback on their courses
- Communicate with learners via Dashboard Messages
- View Notifications

### Learner (**mobile app & web access**)
Consumes learning, tracks progress. All learner interactions are via the website. Do NOT build learner app view for this feature.
- View + enroll in courses from catalog (self-enrollment) from mobile app & website
- Access required courses (assigned via job title → qualifications mapping) via mobile app and website
- Take quizzes (auto-graded, instant results) via website
- Submit assignments via website
- Enter attendance passcode for live sessions via mobile app
- Mark external link courses as complete via website
- View own grades, scores, feedback via website
- Rate completed courses (1–5 stars + optional comment) via mobile app and website
- Download certificates via website
- Chat with instructor (active course only) via website
- View Notifications + Alerts via website

---

## 6. Business Architecture

### 6.1 Core Hierarchy

```
Job Title  (fixed list, e.g. "Site Engineer")
  └── Admin assigns → Qualifications  (e.g. "Fire Safety Certified")
                            └── Courses that earn this qualification
                                  ├── Optional: prerequisite qualification
                                  ├── Certificate: Yes / No
                                  │     └── If Yes: optional min-score criteria
                                  └── Content components (Required / Optional)
```

**Key decisions:**
- **No Skills Package layer** — Job Title maps directly to Qualifications
- **No expiry concept** — Qualifications do not expire; no expiry date on qualifications or courses
- **Qualification fields: EN name + AR name only** — no category, no expiry, no code
- **Job Titles are a fixed list** — Admin cannot add/delete job titles, only assign qualifications to them
- **Courses earn qualifications** — admin assigns qualifications to a course at creation/edit

### 6.2 Enrollment Flow

```
Required path:
  Employee assigned Job Title → qualifications appear in learner's dashboard
  → Learner enrolls in required courses from their qualification list

Self-enrollment path:
  Learner browses Course Catalog
  → Sees: course description + ratings + instructor name + capacity
  → Clicks Enroll → prerequisite check runs
  → If prerequisite not met: blocked + RPL exception option
  → If course full: "Course Full" notification + waitlisted for next cohort
```

### 6.3 Prerequisite Exception (RPL Flow)

```
Learner blocked at enrollment
  └── Learner submits: note + supporting attachment (existing certificate/evidence)
       └── Sent to: Admin only
            ├── Admin approves → prerequisite waived for this learner
            │                  → audit log entry created
            │                  → learner enrolled + notified
            └── Admin rejects  → reason sent to learner
```

### 6.4 Course Lifecycle

```
States: Building → Pending Review → Active

Building:       Instructor adds content; not yet visible to learners
                Toggle ON  → course sent to instructor immediately on creation
                Toggle OFF → admin holds course in Building and releases manually
Pending Review: Appears in admin "Awaiting Publish" queue
Active:         Open for enrollment; visible to learners in catalog

"Send to Instructor" toggle (at course creation):
  Toggle ON  → course goes directly to instructor in Building state
               (appears in instructor dashboard immediately)
  Toggle OFF → admin holds the course in Building state until manually released

Cohort model (within a published course):
  Cohort A [Jan 2026 · 30 seats · Closed]
  Cohort B [Mar 2026 · 30 seats · Open]       ← "New Cohort" by instructor
  Cohort C [Jun 2026 · 30 seats · Scheduled]

"New Cohort" = instructor sets new dates + capacity only. Content is shared.
"Course Full" → learner sees message + auto-notified when next cohort opens.
Content changes by instructor apply to new cohorts only (not current enrollees).
```

### 6.5 Attendance Tracking

```
Live sessions (Offline / Blended / any scheduled live online event):
  Instructor clicks "Start Session" on dashboard
  → Passcode auto-generates + appears on instructor's screen
  → Instructor shares code verbally / displays it
  → Learner opens mobile app → enters passcode → marked as Attended
  → Instructor can override any learner's attendance at any time

Self-paced modules (Online):
  Completion tracked automatically on module finish

External Link courses:
  Learner visits external URL → returns to website or mobile app
  → Clicks "Mark as Complete" button → no proof upload required

Course completion = ALL required components done (as defined by course builder)
```

### 6.6 Offline Session Location

```
Fixed location: Instructor writes room/building/address in session setup
Variable location: Instructor sets as "TBD"
  → Learners see "Location: To Be Announced"
  → When instructor updates location → enrolled learners receive
    🔵 Info alert: "Location confirmed for [Session]: [Location]"
```

### 6.7 Grading & Certification

```
Quizzes (auto-graded):
  Learner submits → score calculated instantly → results shown immediately
  Per-question breakdown: correct answer + optional instructor explanation shown

Assignments (manually graded):
  Learner submits → instructor reviews
  → Instructor gives score + optional written feedback per learner
  → Learner sees score + feedback after instructor publishes grade

Certification trigger:
  If Course Certificate = Yes:
    If min-score criteria set: score meets/exceeds threshold → PDF generated
    If no criteria: attendance (session + module completion) → PDF generated
    If score fails criteria: no certificate + "Your instructor will unlock a retake"
  If Course Certificate = No: no certificate issued regardless

Retake:
  Instructor manually unlocks retake per individual learner (not automatic)
  On retake: question order randomised

Certificate PDF (NAS-branded default template):
  Auto-fills: Learner full name · Course name · Completion date · Instructor name
  Available in: Learner dashboard (download) + Admin compliance reports
```

### 6.8 Course Ratings

```
Triggered: after learner completes course (website or mobile app prompt)
Format: 1–5 stars + optional written comment
Visible to:
  - Admin ratings page (all courses, all instructors — view-only)
  - Instructor dashboard (per course)
  - Course detail page tabs (per course, with breakdown)
  - Course catalog card (next enrollees see aggregate)
Abnormal detection: average drops > 1 star within 7 days → 🔴 Critical alert to admin
```

### 6.9 Admin Messages (One-Way)

```
Admin creates a message:
  Subject + body
  Recipients: multi-select from searchable list
    ├── Scope toggle: Learners / Instructors (checkboxes)
    └── Search: filter names in real time

Delivered to recipient's notification inbox.
Admin tracks: read count / total recipients per message.
Clickable rows on messages list → detail view (full body + recipients + read receipt).

This is NOT the same as in-course chat (chat = instructor ↔ learner, per course).
```

### 6.10 Resources / Learning Materials

```
Types:
  Article     → Rich text written in the LMS (textarea)
  External Link → URL pasted by admin/instructor
  File/Document → Upload (PDF, DOCX, XLSX, PPTX — max 50 MB)

Each resource can optionally be linked to a Qualification.
  → Surfaces in relevant qualification context
  → Shown as a teal badge on the resource card

Add page: /resources/add (dedicated page, not a modal)
Detail/edit page: /resources/:id (view + edit modal inline)

Visible to all employees.
Admin can delete any resource.
```

### 6.11 Learner Types (Online / Offline / Hybrid)

```
Each learner has a learner_type:
  online   → primarily attends online/self-paced courses
  offline  → primarily attends in-person/offline sessions
  hybrid   → mix of both

Used in:
  → Users page sub-filter (visible when Learners tab is active)
  → Future: personalised course recommendations
```

### 6.12 Job Role Change

```
When employee's job title changes:
  Completed qualifications: stay completed (history preserved)
  In-progress courses: stay in progress (not interrupted)
  New title's qualifications: added on top (new qualifications queued)
```

---

## 7. Feature Specifications

### 7.1 Quiz System

**Question types (all auto-graded):**

| Type | Description |
|---|---|
| Multiple Choice | 1 correct answer, up to 5 options |
| Multiple Select | Multiple correct answers |
| True / False | Binary |
| Fill in the Blank | Learner types answer (exact match or keyword match) |
| Match Pairs | Drag-and-drop pairing |
| Order / Sequence | Arrange items in correct order |
| Hotspot | Click/tap correct area on an image |
| Scenario-based | Image or text prompt + MCQ response |

**Quiz settings (per quiz, set by instructor):**

| Setting | Default |
|---|---|
| Timer per question | OFF |
| Leaderboard within cohort | OFF |
| Streak indicator | ON |
| Instant feedback after each question | ON |
| Randomise question order on retake | ON |

**Results page:** Total score + pass/fail + per-question breakdown + time spent.

**Question bank:** Instructor builds reusable questions tagged by topic/qualification. CSV bulk import supported.

### 7.2 Course Setup Fields

| Field | Required | Who sets it |
|---|---|---|
| Title | Yes | Admin / Instructor |
| Description | Yes | Admin / Instructor |
| Content Type | Yes | Online · Offline · Blended · External Link |
| Instructor | Yes | Admin assigns |
| Category | Yes | Admin assigns |
| Module order | Yes | Sequential (default) or Free |
| Cohort start/end dates | Yes | Set at creation |
| Max learners per cohort | Yes | Default 30; instructor can override per cohort |
| Certificate | Yes | Yes / No explicit toggle |
| Certification min-score | No | If Certificate = Yes |
| Prerequisite qualification | No | Must be earned before enrollment |
| Qualifications earned | No | Multi-select; learners earn on completion |
| Session location | Per session | Fixed text or "TBD" |
| External URL | If type = External Link | Direct URL |
| Send to Instructor | No | Toggle: ON → sent to instructor in Building immediately; OFF → admin holds in Building |

### 7.3 Chat

- Scope: Instructor ↔ Learner, active course context only
- Not a general inbox — conversation is tied to the specific course
- New message → 🟠 Warning alert to recipient

### 7.4 Reports (Admin Export)

| Report | Data |
|---|---|
| Compliance by Job Title | Title → qualification completion % |
| Individual Compliance | Employee → each qualification status |
| Attendance | Course → cohort → learner → sessions attended |
| Completion | Course → cohort → learner → completion status + date |
| Scores | Course → learner → quiz/assignment scores |
| Certificate Status | Who earned which certificates + dates |

All reports exportable to CSV / Excel.

---

## 8. Dashboard Sections — Per Role

### Admin Dashboard (implemented)

| # | Section | Content |
|---|---|---|
| 1 | Page header | "Good [morning/afternoon], [Name]" + date + Quick Actions: Add Course · Manage Users |
| 2 | KPI Cards | Active Learners (online/offline sub-count) · Active Courses · Org Compliance % · Awaiting Publish |
| 3 | Important Alerts | Critical: abnormal ratings · Warning: pending grading, courses awaiting publish |
| 4 | Analytics Chart | Enrollment + completion trend (line/area, date range filter) |
| 5 | Skills Compliance by Job Title | Table: job title → qualification completion % |
| 6 | Top Enrolled Courses | Table: course, instructor, enrolled, completion %, status, actions |
| 7 | Department Breakdown | Table: dept → active courses, enrollments, completion, compliance badge |

> **Removed:** Expiring Qualifications section (no expiry concept).

### Instructor Dashboard

| # | Section | Content |
|---|---|---|
| 1 | Page header | Greeting + today's date |
| 2 | Important Alerts | Uncorrected assignments/quizzes · upcoming sessions · messages |
| 3 | KPI Cards | Active Courses · Total Students · Pending Grading · Today's Sessions |
| 4 | This Week's Schedule | Session blocks with time, course name, location |
| 5 | My Courses | Cards: title · status · enrolled · completion % · pending grading |
| 6 | Recent Student Activity | Completions, submissions, new messages, ratings received |

### Learner Dashboard *(website + mobile app)*

| # | Section | Content |
|---|---|---|
| 1 | Page header | Greeting + job title + overall qualification progress % |
| 2 | Important Alerts | Due today · upcoming deadlines · new assignments · new messages |
| 3 | Active Course hero | Current course: % done · Continue button |
| 4 | My Qualifications | Progress bars per qualification: courses done / total required |
| 5 | Upcoming Schedule | Next 3–5 sessions: date · time · course · location |
| 6 | Certificates & Achievements | Recently earned + next milestone |

---

## 9. Navigation Structure — Per Role

### Admin (current nav — in sidebar)

```
Dashboard
Courses           all courses · create · pending queue
Users             learners + instructors, with online status
Job Titles        fixed list; assign qualifications per title
Qualifications    EN+AR name; manage list
Ratings           view-only; all learner ratings to instructors
Messages          admin one-way messages; compose + history
Resources         articles · links · files; add + detail pages
Assignments       view-only; all learner submissions
Quizzes           view-only; all learner attempts
Categories
Certificates
Settings          platform config + About Us
Audit Log
Reports
Notifications
```

### Instructor

```
Dashboard
My Courses
Grading           assignments + quizzes — pending grading centre
Schedule          calendar — sessions + live events
Attendance        per session — mark/override per learner
Analytics         per course — completion, scores, question analytics
Messages          per-course chat with learners
Notifications
```

### Learner *(website + mobile app)*

```
Dashboard
My Courses        Active / Completed tabs
Assignments       submit + view feedback
Quizzes           take + view results
Schedule          upcoming sessions
Course Catalog    browse + preview + self-enroll
Messages          per-course chat with instructor
Certificates      download earned certificates
Notifications
```

---

## 10. UX Rules

### Layout
- Sidebar: 260px expanded · 72px icon-only · 0px collapsed (mobile)
- Sidebar states persist in `localStorage`
- Sidebar toggle: hamburger in top header (mobile), inline chevron button inside logo row (desktop)
- Main content area: scrollable, `min-width: 0`

### Accessibility
- All interactive elements: `min-height: 44px` (WCAG touch target)
- Focus ring: `2px solid var(--border-focus)` with `outline-offset: 2px`
- ARIA labels on all icon-only buttons
- `aria-current="page"` on active nav items
- `role="alert"` on error messages
- Progress bars: `role="progressbar"` with `aria-valuenow/min/max`

### RTL Support
- HTML `dir` from session lang: `ltr` (EN) · `rtl` (AR)
- `[dir="ltr"]` → `font-family: var(--font-english)`
- `[dir="rtl"]` → `font-family: var(--font-arabic)`
- Directional icons use `.icon-directional` → `scaleX(-1)` in RTL
- Always use logical CSS: `ps-`, `pe-`, `ms-`, `me-`, `start`, `end`
- Language toggle: visible in sidebar footer and header

### Sidebar Icons
- All icons: **outlined** (stroke-based), not filled
- Stroke width: `1.7`
- Size: `w-5 h-5` (20×20px)

### Online Status Dots
- Online: `w-2.5 h-2.5 rounded-full` · `background: var(--color-status-green-500)`
- Offline: same size · `background: var(--color-grey-500)`
- Position: `absolute bottom-0 end-0` on a `relative` avatar wrapper
- Border: `border-2 border-white` to separate from avatar

### Toast Notifications
Dispatched via Alpine.js: `$dispatch('toast', { message: '...', type: 'success' | 'error' })`
Caught by `@toast.window` listener in `app.blade.php`.

---

## 11. Alert System

Three priority tiers — shown in the alerts panel at top of dashboard.

### 🔴 Critical
- Prerequisite block preventing enrollment
- Abnormal rating drop (> 1 star avg drop in 7 days)
- Learner failed certification (no certificate issued)

### 🟠 Warning
- Learner falling significantly behind cohort pace
- Assignment/quiz submissions pending grading (instructor)
- New message received
- Course awaiting admin publish (admin only)

### 🔵 Info
- Session reminder (24h before)
- New enrollment in course
- Location confirmed for session (updated from TBD)
- Admin broadcast notification received
- New course rating received (instructor)
- Cohort now open (learner was on waitlist)

---

## 12. Component Inventory

### CSS Utility Classes (in `app.css`)
- `.nas-card` — content card
- `.nav-item` — sidebar navigation link
- `.nav-group-label` — sidebar section header
- `.sidebar-tooltip` — tooltip for icon-only sidebar state
- `.badge`, `.badge-green`, `.badge-orange`, `.badge-red`, `.badge-teal`, `.badge-grey`
- `.btn-primary`, `.btn-secondary`
- `.nas-input`, `.nas-label`, `.nas-error`

### Blade UI Components (`resources/views/components/ui/`)

All 7 components are **built and live**:

| Component | Usage | Props / Slots |
|---|---|---|
| `x-ui.stat-card` | KPI / metric card | `value`, `label`, optional `href`, optional trend; `$slot` for extras |
| `x-ui.progress-bar` | Coloured progress bar | `value` (0–100), `color`, `height`, `label` (bool) |
| `x-ui.empty-state` | Empty content placeholder | `title`, `description`; slots: `icon`, `action` |
| `x-ui.breadcrumb` | Page breadcrumb trail | `items` array `[['label','href?'],...]` |
| `x-ui.page-header` | Page title + description row | `title`, `description`; slot: `actions` |
| `x-ui.action-menu` | Three-dot dropdown (fixed-position, escapes overflow) | `label`; slot: menu items |
| `x-ui.modal` | Centered modal overlay | `open-var`, `title`, `max-width`; slots: `body`, `footer` |

---

## 13. Implementation Status

### ✅ Built (Admin web dashboard — prototype with demo data)

| Route | View | Controller | Notes |
|---|---|---|---|
| `/dashboard` | `dashboard/index` | `DashboardController` | 7 sections; KPIs with online/offline counts |
| `/courses` | `courses/index` | `CoursesController` | Tabs: all/active/pending/building; 3-dot menu with Publish for pending |
| `/courses/{id}` | `courses/show` | `CoursesController@show` | 6 tabs: overview/cohorts/learners/content/qualifications/ratings |
| `/users` | `users/index` | `UsersController` | Online dots; tabs: all/learner/instructor; learner sub-filter: online/offline/hybrid; profile slide-over; edit modal |
| `/job-roles` | `job-roles/index` | `JobRolesController` | Fixed title list; assign qualifications modal with search |
| `/qualifications` | `qualifications/index` | `QualificationsController` | EN+AR name only; add + delete modal |
| `/ratings` | `ratings/index` | `RatingsController` | View-only; filter by course + instructor |
| `/messages` | `messages/index` | `MessagesController` | Compose with recipient search + scope toggles; clickable rows → detail modal |
| `/resources` | `resources/index` | `ResourcesController` | List with type icons; titles link to detail page |
| `/resources/add` | `resources/create` | `ResourcesController@create` | Dedicated page; type-conditional fields (article/link/file) |
| `/resources/{id}` | `resources/show` | `ResourcesController@show` | Detail + inline edit modal |
| `/assignments` | `assignments/index` | — (stub route) | View-only; filter by course/instructor/learner/status |
| `/quizzes` | `quizzes/index` | — (stub route) | View-only; filter by course/instructor/learner/status |
| `/config` | `settings/index` | `SettingsController` | Includes About Us: description, mission, vision |
| `/reports` | `reports/index` | `ReportsController` | |
| `/notifications` | `notifications/index` | `NotificationsController` | |
| `/categories` | `categories/index` | `CategoriesController` | |
| `/certificates` | `certificates/index` | `CertificatesController` | |
| `/audit-log` | `audit-log/index` | `AuditLogController` | |

### 🔲 Not yet built

- Instructor dashboard + all instructor views
- Learner web views (dashboard, my courses, catalog, assignments, quizzes, schedule, messages, certificates, notifications)
- Mobile app — learner mobile interface
- Real database models + migrations (all data is currently hardcoded in controllers)
- Authentication (no auth middleware — all routes open in demo mode)
- Course content builder (modules, quizzes, assignments — full CRUD)
- Notifications detail / compose view
- Reports export (CSV/Excel)
- In-course chat
- Certificate PDF generation

### Known Gaps (admin flow — low priority)

| Page | Gap |
|---|---|
| Notifications | "View Details" shows placeholder toast, no detail content |
| Audit Log | Search/filter inputs have no Alpine binding |
| Job Titles | No real edit modal for the job title itself (only qualification assignment) |
| Users | Name cell not clickable (only three-dot opens profile) |

---

## 14. Demo Data & Dev Patterns

### Demo Data Approach
All data is hardcoded arrays in controller `index()` / `show()` methods.
No Eloquent models, no migrations, no seeder files yet.
All routes return HTTP 200 in demo mode.
No authentication middleware on any route.

### PHP → Alpine Data (safe HTML attributes)
Use `json_encode()` with `JSON_HEX_APOS | JSON_HEX_TAG` inside a **single-quoted** Alpine attribute:

```php
@php
    $uJson = json_encode(['id'=>$user['id'],'name'=>$user['name'],...], JSON_HEX_APOS|JSON_HEX_TAG);
@endphp
<button @click='profileUser = {{ $uJson }}; profileOpen = true'>...</button>
```

**Do NOT use `Js::from()`** — `Illuminate\Support\Js` is not registered as a facade alias.

### Client-side Row Filtering (x-show on PHP-rendered rows)

```html
<tr x-show='
    (tab === "all" || tab === {{ json_encode($item["role"], JSON_HEX_APOS) }})
    && (!search || {{ json_encode(strtolower($item["name"]." ".$item["email"]), JSON_HEX_APOS) }}.includes(search.toLowerCase()))
'>
```

### Fixed-Position Dropdown (escapes `overflow:hidden` tables)

```js
@click.stop="
    const r = $refs.btn.getBoundingClientRect();
    pos = { top: r.bottom + 4, right: window.innerWidth - r.right };
    open = !open
"
```
```html
<div class="fixed z-50" :style="`top: ${pos.top}px; right: ${pos.right}px;`">
```

### Right Slide-Over Panel

```html
<div x-show="panelOpen" class="fixed inset-0 z-50">
  <div class="absolute inset-0" style="background:rgba(0,0,0,0.4);" @click="panelOpen=false"></div>
  <div class="absolute top-0 bottom-0 end-0 w-full max-w-sm flex flex-col shadow-2xl"
       style="background: var(--surface-card);"
       x-transition:enter="transition ease-out duration-300"
       x-transition:enter-start="opacity-0 translate-x-8"
       x-transition:enter-end="opacity-100 translate-x-0">
    <!-- content -->
  </div>
</div>
```

### Sidebar State
- 3 states: `expanded` (260px) · `icon-only` (72px) · `collapsed` (0px/mobile)
- `toggle()` → expanded ↔ icon-only
- `mobileToggle()` → collapsed ↔ expanded
- State persisted in `localStorage.getItem('sidebar')`
- Collapse/expand button lives **inside the logo header row** (not a bottom block)
- Hamburger in top header is `lg:hidden` (mobile only)

### Toast
```js
$dispatch('toast', { message: 'Done!', type: 'success' })  // or type: 'error'
```
Caught by `@toast.window` in `app.blade.php`.

### Course Status Badges
```
active    → badge-green
pending   → badge-orange
building  → badge-grey
```

### Course Type Badges
```
online        → badge-teal
offline       → badge-grey
blended       → badge-green
external_link → badge-orange
```
