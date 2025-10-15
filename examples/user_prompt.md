# Example User Prompt

## Feature: User Authentication

### User Story
As a user, I want to securely log into the application so that I can access my personalized dashboard and account features.

### Context
This is a standard login flow for a web application with username/password authentication. The system should support:
- Email or username-based login
- Password validation
- Session management
- Remember me functionality
- Error handling for invalid credentials
- Account lockout after multiple failures

### Expected Flows

**Happy Path:**
1. User navigates to login page
2. User enters valid credentials
3. User clicks "Login" button
4. User is redirected to dashboard with welcome message

**Alternative Flows:**
- User selects "Remember me" checkbox
- User clicks "Forgot password?" link
- User tries to access protected page while logged out

**Error Cases:**
- Invalid username
- Invalid password
- Account locked
- Network timeout
- CSRF token mismatch

### Non-Functional Requirements
- Login response time < 2 seconds
- WCAG 2.1 Level AA compliance
- Support for password managers
- Rate limiting (5 attempts per 15 minutes)

### Acceptance Criteria

**AC-001**: Given a user with valid credentials, when they enter their username and password and click Login, then they should be redirected to the dashboard.

**AC-002**: Given a user with invalid credentials, when they attempt to login, then they should see an error message "Invalid username or password".

**AC-003**: Given a user who checks "Remember me", when they login and return later, then they should still be logged in.

**AC-004**: Given a user who exceeds 5 login attempts, when they try again, then their account should be temporarily locked for 15 minutes.

**AC-005**: Given a user who clicks "Forgot password", when the link is clicked, then they should be redirected to the password reset flow.

### Related Documents
- Design Mockup: `/docs/designs/login-flow.pdf`
- API Spec: `/docs/api/authentication.md`
- Security Requirements: JIRA-AUTH-001

