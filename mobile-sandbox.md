# TASK

Create a completely isolated Angular testing module called:

mobile-sandbox

This module is NOT part of production.

Purpose:
Validate all Laravel APIs used by the future mobile application before mobile development starts.

Requirements:

- Create everything inside:

src/mobile-sandbox

- Never modify existing production pages.
- Never modify existing routes except adding one parent route:

/test-mobile

- Reuse existing API services whenever possible.
- If an API service is missing, create it.
- If backend APIs require modifications, document them.

# Goal

Simulate the complete mobile learner journey.

Flow:

Login
→ Get Current User
→ Dashboard
→ Courses List
→ Course Details
→ Start Course
→ Lessons
→ Complete Lesson
→ Quizzes
→ Submit Quiz
→ Certificates
→ Notifications
→ Profile
→ Logout

# Testing Requirements

For every API:

1. Create a dedicated test page.
2. Display request payload.
3. Display response payload.
4. Display response time.
5. Display HTTP status code.
6. Display validation errors.
7. Display server errors.

# API Validation

Verify:

- Authentication
- Authorization
- Pagination
- Filtering
- Sorting
- Locale support
- Enum values
- Empty states
- Error responses
- Upload endpoints
- Download endpoints

# Self-Healing

If Angular code requires API changes:

1. Locate Laravel endpoint.
2. Fix DTO/Resource/Request if needed.
3. Update Swagger annotations.
4. Regenerate Swagger.
5. Continue execution.

# Logging

Create:

mobile-sandbox/logs

Store:

- API name
- Request
- Response
- Status
- Errors
- Timestamp

# Deliverables

Generate:

mobile-sandbox/API-COVERAGE.md

containing:

- Endpoint
- Method
- Status
- Tested
- Passed
- Failed
- Required Backend Fixes

Generate:

mobile-sandbox/MISSING-ENDPOINTS.md

Generate:

mobile-sandbox/BACKEND-CHANGES.md

# Important

This module is temporary.

Everything must remain isolated under:

mobile-sandbox

so the entire folder can be deleted later without affecting the real Angular application.

You have access to both Angular frontend and Laravel backend.

Whenever an API contract mismatch is detected:

- Fix Angular service.
- Fix Laravel controller/resource/request.
- Fix Swagger annotations.
- Re-test automatically.

The goal is to achieve a fully working mobile flow with zero manual intervention.

- Figma links

employee courses
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-38360&m=dev

employee course details
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-38627&m=dev
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-38425&m=dev
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-38830&m=dev

employee learning section (from his/her profile)
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-39486&m=dev

view attendance
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-39691&m=dev

mark present
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-40149&m=dev
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-40427&m=dev
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-40708&m=dev
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-40991&m=dev

ratings
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-41225&m=dev
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-41430&m=dev
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-41637&m=dev
https://www.figma.com/design/JnNkT9eeYmRiDOuapW4RKf/LMS?node-id=543-41844&m=dev

Shared API Token For Mobile : 0ecCah0hLg9Ju8921KBViCgYlBEGdSKBZZl4xcTGfCUFh9WVSag2gKuz3zva
Employee Code : 2394 for test
