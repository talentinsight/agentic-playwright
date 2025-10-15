# Test Charter

**Feature:** [Feature Name]  
**Date:** [Date]  
**QA Agent:** Agentic Playwright  
**Version:** 1.0

---

## Objective

Define the scope, approach, and acceptance criteria for testing the [Feature Name] feature.

---

## Scope

### In Scope

- **Functional Testing**: Core feature functionality as per acceptance criteria
- **Integration Testing**: Interactions with dependent systems/services
- **UI/UX Testing**: User interface behavior and experience
- **Accessibility Testing**: WCAG 2.1 Level AA compliance
- **Error Handling**: Negative scenarios and edge cases
- **Cross-browser Testing**: Chromium, WebKit, Firefox
- **Role-based Testing**: Different user roles and permissions

### Out of Scope

- Performance/load testing (unless specified)
- Security penetration testing
- Mobile native apps (if web-only)
- Third-party integrations not directly related

---

## Test Environment

### Environments

| Environment | URL | Purpose | Auth Required |
|------------|-----|---------|---------------|
| Local | http://localhost:3000 | Development | Yes |
| Dev | https://dev.example.com | Integration | Yes |
| Staging | https://staging.example.com | Pre-prod validation | Yes |
| Production | https://prod.example.com | Smoke tests only | Yes |

### Browser Matrix

| Browser | Version | Priority |
|---------|---------|----------|
| Chromium | Latest | P0 |
| WebKit | Latest | P1 |
| Firefox | Latest | P1 |

### Test Users

| Role | Username | Purpose |
|------|----------|---------|
| Admin | admin@test.com | Full permissions |
| User | user@test.com | Standard user |
| Guest | guest@test.com | Limited access |

---

## Test Approach

### Strategy

1. **Requirements Analysis**: Extract acceptance criteria from RAG sources
2. **Scenario Design**: Create Gherkin-style scenarios with Given/When/Then
3. **Test Implementation**: Build Playwright tests using POM pattern
4. **Execution**: Run tests across browser matrix
5. **Debugging**: Analyze failures with traces
6. **Validation**: Ensure 2+ consecutive green runs

### Test Types

- **Smoke Tests** (`@smoke`): Critical happy paths, must pass
- **Regression Tests** (`@regression`): Full feature coverage
- **Accessibility Tests** (`@a11y`): Axe-core validation
- **Negative Tests**: Error states and validation
- **Edge Cases**: Boundary conditions

### Priorities

- **P0**: Critical functionality, blocks release
- **P1**: Important functionality, should be tested
- **P2**: Nice-to-have, optional

---

## Test Data Requirements

### Data Setup

- **User Accounts**: Pre-seeded test accounts with various roles
- **Sample Data**: Representative data sets for testing
- **State Management**: Isolated test data per scenario

### Data Cleanup

- **Teardown Strategy**: Clean up after each test
- **Idempotency**: Tests can run multiple times without side effects

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Flaky selectors | High | Medium | Use semantic selectors (role-based) |
| Timing issues | Medium | High | Use expect() with auto-waiting |
| Data dependencies | High | Medium | Isolate test data, use fixtures |
| Environment instability | Medium | Low | Health checks before tests |

---

## Success Criteria

### Acceptance Gates

- [ ] 100% of P0/Smoke scenarios passing
- [ ] ≥80% of total planned scenarios passing
- [ ] 2+ consecutive green runs locally
- [ ] 1+ green CI run
- [ ] No hard-coded secrets or URLs
- [ ] Accessibility checks pass on critical paths
- [ ] Documentation complete (README_test.md)

### Coverage Targets

- **Acceptance Criteria Coverage**: 100%
- **Edge Cases Coverage**: ≥70%
- **Negative Scenarios**: ≥50%

---

## Deliverables

1. **Scenario Document**: `tests/_plans/{feature}.scenarios.md`
2. **Page Objects**: `src/pages/{Feature}Page.ts`
3. **Test Specs**: `tests/e2e/{feature}.spec.ts`
4. **Test Fixtures**: `tests/fixtures/{feature}.ts` (if needed)
5. **Test Report**: HTML report with traces on failure
6. **Documentation**: Updated README_test.md with instructions

---

## Timeline & Milestones

| Phase | Deliverable | Estimated Time |
|-------|-------------|----------------|
| Phase 1 | Scenario Design | 30 min |
| Phase 2 | POM & Test Implementation | 1-2 hours |
| Phase 3 | Execution & Debugging | 30-60 min |
| Phase 4 | Validation & PR | 30 min |

**Total Estimated Time**: 2.5-4 hours (depending on complexity)

---

## Notes & Assumptions

- Tests will be deterministic and stable
- No arbitrary waits or sleeps
- All selectors will be semantic and accessible
- Tests will run in parallel where possible
- CI environment will have necessary dependencies

