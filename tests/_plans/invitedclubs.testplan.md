# InvitedClubs.com — Test Plan

## Executive summary
InvitedClubs.com is a marketing/sales site for meeting clubs and venues. This test plan covers functional, UX, accessibility (A11y), cross-browser, performance, and security checks for the public site (no authentication flows). The goal is to validate critical user journeys (home, search/browse venues, contact/booking inquiry, content pages), identify edge cases, and provide runnable test scenarios suitable for manual testing and automation with Playwright.

**Scope:** public website pages and interactive forms (contact/booking). No authenticated dashboard flows.

**Test objectives:**
- Ensure core navigation works across major browsers and viewports
- Validate forms submit and handle validation errors gracefully
- Verify content, links, and assets load and are accessible
- Perform basic performance and SEO checks
- Provide automation-friendly selectors and test data

---

## Assumptions
1. Tests run from a clean environment (fresh browser profile, no cached auth). Assume anonymous users only.
2. Backend APIs are available and not rate-limited for test traffic.
3. No staging-specific credentials; tests use test-friendly data or mocks where necessary.
4. Forms send real emails only in staging; in production tests, use non-destructive checks.

---

## Test environments
- Browsers: Chromium (latest), Firefox (latest), WebKit (Safari macOS).
- Devices/viewports: Desktop (1366x768), Tablet (768x1024), Mobile (375x812).
- Network: Regular and throttled (Slow 3G) for performance/resilience tests.

---

## Top-level user journeys (critical paths)
1. Home page discovery — open `https://www.invitedclubs.com/`.
2. Navigation — main menu, footer links, and internal anchors.
3. Search / browse venues — if site offers search/filter, filter results, open venue details.
4. Contact / booking inquiry — open contact form, submit with valid and invalid data.
5. Content pages — About/Services/FAQ — verify content and links.
6. External links — social, partner links open in new tab and are correct.

---

## Test scenarios (each scenario includes: steps, expected results, assumptions, success/failure criteria)

### 1. Home page load (happy path)
Assumptions: site reachable
Steps:
1. Navigate to `https://www.invitedclubs.com/`.
2. Observe page title, meta description, and hero header.
3. Verify main navigation (header) links are visible and clickable.
4. Scroll to bottom, verify footer links present.
Expected results:
- Page loads within 3s on desktop (network test dependent).
- No JS errors in console.
- Navigation links lead to appropriate pages (200 OK).
Success: all checks pass.
Failure: page returns 4xx/5xx, console errors, or navigation broken.

### 2. Mobile responsiveness (happy path)
Assumptions: responsive design implemented
Steps:
1. Set viewport to 375x812.
2. Load home page.
3. Open mobile menu (hamburger) and navigate to a content page.
Expected results:
- Mobile nav opens and links work.
- All important content fits viewport (no horizontal scroll).
- CTA buttons are tappable.

### 3. Contact / booking form — validation and submission
Assumptions: form exists at /contact or via modal
Steps:
1. Navigate to contact page.
2. Submit empty form -> validate client-side validation messages.
3. Fill invalid email -> check inline validation.
4. Fill valid data and submit (use test email like test+automation@example.com).
Expected results:
- Validation messages are informative and focused to fields.
- Successful submission returns 200 and shows success message.
- No PII leaks in request logs.

### 4. Search / filter venues (if present)
Assumptions: search endpoint is present
Steps:
1. Enter a search term (e.g., "rooftop") and execute search.
2. Apply filter (e.g., "capacity > 100").
3. Verify results update and detail pages open.
Expected results:
- Search response within 2s server-side, UI updates accordingly.
- Filters persist when navigating to a detail and back.

### 5. Broken links and assets
Steps:
1. Crawl site (top-level pages) and capture all links and asset URLs.
2. Verify HTTP status for each link (expect 200 for internal, 301/302 acceptable for redirects).
Expected results:
- No unexpected 4xx or 5xx links.

### 6. Accessibility smoke tests
Steps:
1. Run automated Axe (or axe-core) against the home page.
2. Check keyboard navigation: tab order, focus indicators, skip links.
3. Verify images have alt text and form fields have associated labels.
Expected results:
- No critical WCAG violations.
- All interactive controls accessible by keyboard.

### 7. Performance and lighthouse checks
Steps:
1. Run Lighthouse (desktop & mobile) for Home page.
2. Note Performance, Accessibility, Best Practices, SEO scores.
3. Investigate large assets and time-to-interactive.
Expected results:
- Performance score >= 60 on mobile (adjustable based on site complexity).
- Largest Contentful Paint (LCP) < 2.5s on desktop when network normal.

### 8. Privacy & security quick checks
Steps:
1. Ensure site uses HTTPS and HSTS headers.
2. Check for insecure mixed content.
3. Verify CSP header exists and X-Frame-Options present.
Expected results:
- HTTPS enforced, no mixed content.
- CSP present; important security headers enabled.

---

## Edge cases and negative tests
- Form spam/bot submission: test reCAPTCHA or honeypot handling if present.
- Slow network: try form submission on Slow 3G and ensure graceful timeout/error messaging.
- Invalid redirects: test deep linking to anchors; if not found, shows 404 gracefully.
- Broken image placeholders: simulate image 404 and ensure fallback text is present.
- Rate limiting: verify API returns 429 handled gracefully in UI.

---

## Test data
- Contact form: use `test+automation+timestamp@example.com` as email.
- Search terms: rooftop, ballroom, rooftop bar, meeting room.
- Phone number: use placeholder `+1-555-0100` for testing (do not use real numbers).

---

## Automation plan (Playwright)
- Create a small Page Object Model (POM): `HomePage`, `ContactPage`, `SearchPage`, `VenuePage`.
- Use semantic selectors where possible: getByRole, getByLabelText, getByText.
- Structure tests in `tests/e2e/` with tags: @smoke @p0 for critical paths.
- Add accessibility checks using `@axe-core/playwright` in pipeline for p0 tests.
- Parallelize non-conflicting tests (read-only browsing). Keep form submission tests isolated.

Example selectors (preferred):
- CTA primary: `page.getByRole('link', { name: /book|contact|inquire/i })`
- Contact email: `page.getByLabel(/email/i)`

---

## Quality gates (CI)
- p0 tests (home load, contact form validation) must pass before merging.
- Accessibility: no critical violations for p0.
- Lint and type checks must be green.

---

## Deliverables
- `tests/_plans/invitedclubs.testplan.md` (this document)
- `tests/e2e/` Playwright test specs to cover scenarios
- Automation README with how to run locally and in CI

---

## Next steps
1. Confirm which pages and flows on the site you want automated first (Home, Contact, Search).
2. I can scaffold a Playwright test suite (POMs + 3 initial tests) and run them locally.
3. Optionally, provide staging credentials or mock endpoints for non-destructive testing.


*Prepared on 2025-10-14.*
