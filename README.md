# Agentic Playwright Testing Framework

An intelligent, AI-powered end-to-end testing framework that combines Playwright, RAG (Retrieval-Augmented Generation), and MCP (Model Context Protocol) to automate the entire testing lifecycle from requirements mining to PR creation.

## Overview

This framework implements a multi-agent workflow with two specialized AI agents:

- **QA Agent**: Mines requirements from Jira, Confluence, and local documentation using RAG, then generates comprehensive test scenarios
- **SDET Agent**: Designs and implements Playwright tests using best practices, executes tests, debugs failures, and creates GitHub PRs when all tests pass

## Key Features

- 🤖 **Agentic Workflow**: AI agents handle the complete testing pipeline
- 📚 **RAG-Powered Requirements**: Extract and contextualize requirements from multiple sources
- 🎭 **Playwright Integration**: Modern, reliable browser automation
- 🔌 **MCP Protocol**: Standardized communication with Playwright and GitHub services
- ✅ **Quality Gates**: Automated validation before PR creation
- ♿ **Accessibility Testing**: Built-in a11y checks with axe-core
- 📊 **Rich Reporting**: Comprehensive test reports with traces and screenshots
- 🔒 **Security First**: No hard-coded secrets, environment-based configuration

## Architecture

```
┌─────────────────┐
│  User Prompt    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│   QA Agent      │◄─────┤  RAG System      │
│                 │      │  - Jira          │
│ - Requirements  │      │  - Confluence    │
│ - Scenarios     │      │  - Local Docs    │
│ - Test Data     │      └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  SDET Agent     │◄─────┤  Playwright MCP  │
│                 │      │  - Test Execution│
│ - POM Design    │      │  - Codegen       │
│ - Implementation│      │  - Traces        │
│ - Execution     │      └──────────────────┘
│ - Debugging     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  PR Workflow    │◄─────┤  GitHub MCP      │
│                 │      │  - Branch Create │
│ - Quality Gates │      │  - Commits       │
│ - PR Creation   │      │  - PR Open       │
│ - CI Validation │      │  - Checks Status │
└─────────────────┘      └──────────────────┘
```

## Prerequisites

- **Node.js**: ≥18.0.0
- **npm** or **yarn**
- **OpenAI API Key**: For LLM and embeddings
- **Jira & Confluence**: API credentials (optional, for RAG)
- **GitHub Token**: For PR automation
- **ChromaDB**: Vector database for RAG (optional, can run in-memory)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd agentic_playwright
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Playwright browsers**:
   ```bash
   npx playwright install
   ```

4. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

5. **Build the project**:
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `OPENAI_API_KEY`: Your OpenAI API key
- `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`: Jira integration
- `CONFLUENCE_BASE_URL`, `CONFLUENCE_EMAIL`, `CONFLUENCE_API_TOKEN`: Confluence integration
- `GITHUB_TOKEN`: GitHub personal access token
- `TEST_BASE_URL`: Base URL for your application under test

### RAG Sources Configuration

Create a configuration file specifying your requirements sources:

```json
{
  "jira": {
    "issues": ["PROJ-123", "PROJ-456"]
  },
  "confluence": {
    "pages": [
      "https://your-domain.atlassian.net/wiki/spaces/PROJ/pages/123456"
    ]
  },
  "local": {
    "files": ["./docs/requirements.md", "./docs/api-spec.md"]
  }
}
```

## Usage

### Full Agentic Workflow

Run the complete workflow from requirements to PR:

```bash
npm run agentic -- --feature "user-authentication" --sources ./config/rag-sources.json
```

### QA Agent Only

Generate test scenarios without implementation:

```bash
npm run qa -- --feature "shopping-cart" --sources ./config/rag-sources.json
```

### SDET Agent Only

Implement tests from existing scenarios:

```bash
npm run sdet -- --feature "checkout-flow"
```

### Index Documentation

Pre-index your documentation for faster RAG retrieval:

```bash
npm run index-docs -- --config ./config/rag-sources.json
```

### Run Tests Directly

Execute Playwright tests without the agentic workflow:

```bash
# All tests
npm test

# CI mode (Chromium only)
npm run test:ci

# Headed mode
npm run test:headed

# Debug mode
npm run test:debug

# Specific tags
npm test -- --grep @smoke
```

## Project Structure

```
/
├── docs/                      # Documentation
│   ├── requirements_digest.md # Requirements template
│   ├── test_charter.md        # Test charter template
│   ├── ARCHITECTURE.md        # System architecture
│   └── CONTRIBUTING.md        # Contribution guide
├── tests/
│   ├── _plans/                # Test scenario documents
│   ├── e2e/                   # Test specifications
│   └── fixtures/              # Test fixtures
├── src/
│   ├── agents/                # QA & SDET agents
│   ├── mcp/                   # MCP clients
│   ├── rag/                   # RAG implementation
│   ├── pages/                 # Page Object Models
│   ├── utils/                 # Utilities
│   ├── workflows/             # PR workflows
│   ├── cli/                   # CLI interface
│   └── index.ts               # Main entry point
├── scripts/                   # Utility scripts
├── examples/                  # Example implementations
├── playwright.config.ts       # Playwright configuration
└── package.json              # Dependencies
```

## Development

### Build

```bash
npm run build
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Formatting

```bash
npm run format
npm run format:check
```

## Testing Best Practices

This framework enforces the following best practices:

1. **Page Object Model (POM)**: All page interactions are encapsulated in page objects
2. **Semantic Selectors**: Use role-based and accessible selectors
3. **No Sleeps**: Use Playwright's auto-waiting with `expect()`
4. **Test Isolation**: Each test is independent and can run in any order
5. **Fixtures**: Centralized authentication and data setup
6. **Tags**: Organize tests with `@smoke`, `@regression`, `@p0`, etc.
7. **Accessibility**: A11y checks on critical user flows
8. **Deterministic**: Tests produce consistent results across runs

## MCP Server Setup

### Playwright MCP Server

The framework expects a Playwright MCP server running. Set up instructions:

```bash
# Install MCP server (example)
npm install -g @playwright/mcp-server

# Start server
playwright-mcp-server --port 3000
```

Configure the server URL in `.env`:
```
PLAYWRIGHT_MCP_HOST=localhost
PLAYWRIGHT_MCP_PORT=3000
```

### GitHub MCP Integration

GitHub operations use the GitHub MCP client, which requires a personal access token with the following scopes:

- `repo` (full control)
- `workflow` (if updating workflows)

## Troubleshooting

### Common Issues

**Issue**: Tests are flaky  
**Solution**: Ensure you're using semantic selectors and Playwright's auto-waiting. Avoid arbitrary timeouts.

**Issue**: RAG returns irrelevant context  
**Solution**: Improve your query formulation or re-index documents with better chunking.

**Issue**: MCP connection errors  
**Solution**: Verify MCP servers are running and ports are correctly configured in `.env`.

**Issue**: Authentication failures  
**Solution**: Check that test credentials in `.env` are valid and users exist in the test environment.

### Debug Mode

Run tests with trace viewer:

```bash
npm run test:debug
```

Open trace viewer for failed tests:

```bash
npm run trace:open
```

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines.

## License

MIT License - see LICENSE file for details.

## Support

For issues, questions, or contributions, please open an issue on GitHub.

