## System Architecture

The Agentic Playwright framework is designed around a multi-agent architecture where specialized AI agents collaborate to automate the complete testing lifecycle.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Input / CLI                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Orchestrator                               │
│  - Phase Management (0→6)                                    │
│  - Agent Coordination                                        │
│  - Quality Gate Validation                                   │
└─────┬─────────────────────────────┬─────────────────────────┘
      │                             │
      ▼                             ▼
┌──────────────────────┐  ┌──────────────────────┐
│     QA Agent         │  │    SDET Agent        │
│  - Requirements      │  │  - POM Design        │
│  - Scenario Gen      │  │  - Test Implementation│
│  - Edge Cases        │  │  - Execution         │
│  - Test Data         │  │  - Debugging         │
└──────┬───────────────┘  └───────┬──────────────┘
       │                          │
       ▼                          ▼
┌──────────────────────┐  ┌──────────────────────┐
│    RAG System        │  │  Playwright MCP      │
│  - Vector Store      │  │  - Test Execution    │
│  - Doc Loaders       │  │  - Codegen           │
│  - Retriever         │  │  - Trace Analysis    │
└──────────────────────┘  └──────────────────────┘
       │                          │
       ▼                          ▼
┌──────────────────────┐  ┌──────────────────────┐
│  External Sources    │  │   Test Artifacts     │
│  - Jira              │  │  - HTML Reports      │
│  - Confluence        │  │  - Traces            │
│  - Local Docs        │  │  - Screenshots       │
└──────────────────────┘  └──────────────────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │   GitHub MCP         │
                       │  - Branch Create     │
                       │  - Commits           │
                       │  - PR Creation       │
                       └──────────────────────┘
```

### Core Components

#### 1. Orchestrator
- **Purpose**: Coordinates the entire workflow through phases 0-6
- **Responsibilities**:
  - Sequential phase execution with gate validation
  - Agent lifecycle management
  - Error handling and recovery
  - Progress tracking and logging

#### 2. QA Agent (Requirements → Scenarios)
- **Purpose**: Transform requirements into testable scenarios
- **Capabilities**:
  - RAG-powered requirement analysis
  - Gherkin scenario generation
  - Edge case identification
  - Test data contract definition
  - Citation tracking for traceability

#### 3. SDET Agent (Scenarios → Tests)
- **Purpose**: Implement and execute Playwright tests
- **Capabilities**:
  - Page Object Model design
  - TypeScript test implementation
  - Test execution via Playwright MCP
  - Failure analysis and debugging
  - Stability validation (multiple runs)

#### 4. RAG System
- **Purpose**: Retrieve and contextualize requirements
- **Components**:
  - **Vector Store**: ChromaDB for semantic search
  - **Document Loaders**: Jira, Confluence, local files
  - **Retriever**: Query expansion and ranking
  - **Embeddings**: OpenAI text-embedding-3-small

#### 5. MCP Clients
- **Playwright MCP**: Test execution, codegen, traces
- **GitHub MCP**: Git operations, PR creation, CI status

#### 6. Utilities
- **Test Runner**: CLI wrapper for Playwright
- **Report Generator**: Markdown/HTML coverage reports
- **Quality Gates**: Automated validation checks
- **Accessibility**: Axe-core integration

### Data Flow

#### Phase 0-1: Requirements Analysis
```
User Prompt → RAG Retrieval → LLM Analysis → Scenarios
     ↓
  Citations tracked throughout
```

#### Phase 2-3: Test Implementation
```
Scenarios → SDET Agent → POM Design → Test Files
                  ↓
            Playwright MCP
```

#### Phase 4-5: Execution & Validation
```
Tests → Playwright → Results → Quality Gates
          ↓
      Traces/Reports
```

#### Phase 6: PR Creation
```
Results → Report Gen → PR Body → GitHub MCP → PR Created
```

### Technology Stack

- **Language**: TypeScript
- **Test Framework**: Playwright Test
- **LLM**: OpenAI GPT-4o
- **Vector DB**: ChromaDB
- **Version Control**: GitHub via Octokit
- **Logging**: Winston
- **Validation**: Zod
- **CLI**: Commander.js

### Design Principles

1. **Deterministic**: Tests must be stable and reproducible
2. **Traceable**: Every scenario links to requirements
3. **Semantic**: Use accessible selectors (role, label)
4. **Isolated**: Tests run independently
5. **Observable**: Comprehensive logging and reporting
6. **Extensible**: Plugin architecture for custom agents

### Configuration Management

Environment variables organized by concern:
- **OpenAI**: API keys, models
- **Integrations**: Jira, Confluence, GitHub
- **Test Env**: URLs, credentials
- **Feature Flags**: A11y, visual regression

### Error Handling Strategy

1. **Validation Errors**: Fail fast with clear messages
2. **Network Errors**: Retry with exponential backoff
3. **Test Failures**: Capture traces and screenshots
4. **Quality Gates**: Block PR on failure

### Security Considerations

- No secrets in code or configs
- Environment variable validation
- Secret scanning in quality gates
- Secure credential storage recommended

### Performance Optimizations

- Parallel test execution
- Vector search caching
- Connection pooling for APIs
- Incremental document indexing

### Future Enhancements

- Visual regression testing
- Performance benchmarking
- Multi-browser parallelization
- Custom agent plugins
- Real-time test execution dashboard

