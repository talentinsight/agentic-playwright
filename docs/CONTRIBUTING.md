# Contributing to Agentic Playwright

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js ≥18.0.0
- npm or yarn
- Git
- OpenAI API key

### Installation

1. Fork and clone the repository:
```bash
git clone https://github.com/your-username/agentic-playwright.git
cd agentic-playwright
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Build the project:
```bash
npm run build
```

5. Run tests:
```bash
npm test
```

## Development Workflow

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature branches
- `bugfix/*`: Bug fix branches
- `hotfix/*`: Emergency fixes

### Making Changes

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes following the coding standards

3. Add tests for new functionality

4. Run linter and formatter:
```bash
npm run lint:fix
npm run format
```

5. Commit with conventional commits:
```bash
git commit -m "feat: add new feature"
```

## Coding Standards

### TypeScript

- Use strict type checking
- Avoid `any` types (warn only)
- Document public APIs with JSDoc
- Follow existing code patterns

### Testing

- Write tests for all new features
- Maintain test coverage >80%
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Naming Conventions

- **Files**: camelCase.ts
- **Classes**: PascalCase
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces**: PascalCase (no I prefix)

### Code Organization

```
src/
├── agents/      # AI agent implementations
├── mcp/         # MCP client integrations
├── rag/         # RAG system components
├── utils/       # Utility functions
├── workflows/   # Workflow implementations
└── cli/         # CLI commands
```

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or tooling changes

### Examples

```
feat(qa-agent): add edge case generation

Add capability to automatically generate edge case scenarios
based on acceptance criteria analysis.

Closes #123
```

## Pull Request Process

1. Update documentation for any changed functionality

2. Add/update tests as needed

3. Ensure all tests pass:
```bash
npm test
npm run lint
```

4. Update CHANGELOG.md with your changes

5. Create a pull request with:
   - Clear title and description
   - Link to related issues
   - Screenshots/examples if applicable

6. Address review feedback

7. Squash commits before merge

## Testing Guidelines

### Unit Tests

- Test individual functions and classes
- Mock external dependencies
- Fast execution (<1s per test)

### Integration Tests

- Test component interactions
- Use test doubles for external services
- Moderate execution time

### E2E Tests

- Test complete workflows
- Use real or staging environments
- Slower execution acceptable

## Documentation

### Code Documentation

- Document all public APIs
- Include usage examples
- Explain complex algorithms
- Keep comments up to date

### User Documentation

- Update README.md for user-facing changes
- Add examples to docs/
- Include troubleshooting tips

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create release branch
4. Run full test suite
5. Tag release
6. Merge to main
7. Create GitHub release

## Getting Help

- Open an issue for bugs or feature requests
- Join discussions in GitHub Discussions
- Check existing issues and PRs

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Welcome newcomers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

