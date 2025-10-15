# MCP Server Setup Guide

This framework uses the **Model Context Protocol (MCP)** to communicate with Playwright and GitHub services. Follow these steps to set up the required MCP servers.

## What is MCP?

Model Context Protocol is a standardized way for AI applications to communicate with external tools and services. It allows the Agentic Playwright framework to:
- Execute Playwright tests
- Generate test code
- Create GitHub branches and PRs
- Access repository information

## Prerequisites

- Node.js ≥18.0.0
- npm or npx

## Installing MCP Servers

### 1. Playwright MCP Server

The Playwright MCP server provides tools for test execution, code generation, and trace viewing.

```bash
# Install globally (recommended)
npm install -g @playwright/mcp-server

# Or use npx (will download on-demand)
npx @playwright/mcp-server
```

**Available Tools:**
- `playwright_run_tests` - Execute Playwright tests
- `playwright_codegen` - Generate test code
- `playwright_show_trace` - Open trace viewer
- `playwright_install_browsers` - Install browsers
- `playwright_show_report` - Open HTML report

### 2. GitHub MCP Server

The GitHub MCP server provides tools for GitHub operations.

```bash
# Install globally (recommended)
npm install -g @modelcontextprotocol/server-github

# Or use npx
npx @modelcontextprotocol/server-github
```

**Environment Variable Required:**
```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
```

**Available Tools:**
- `create_branch` - Create a new branch
- `create_or_update_file` - Create/update files
- `create_pull_request` - Open a pull request
- `get_file_contents` - Read file contents
- `search_repositories` - Search GitHub repositories
- `fork_repository` - Fork a repository

## Configuration

### Environment Variables

Update your `.env` file:

```env
# GitHub Token (required for GitHub MCP)
GITHUB_TOKEN=ghp_your_personal_access_token

# GitHub Repository
GITHUB_REPO_OWNER=your-org
GITHUB_REPO_NAME=your-repo
GITHUB_BASE_BRANCH=main

# Note: No need to configure MCP server URLs
# The framework connects via stdio transport automatically
```

### GitHub Token Permissions

Your GitHub personal access token needs these scopes:
- ✅ `repo` (full control of private repositories)
- ✅ `workflow` (update GitHub Action workflows)
- ✅ `read:org` (read org and team membership)

Create a token at: https://github.com/settings/tokens/new

## Verifying Installation

### Test Playwright MCP Server

```bash
# List available tools
npx @playwright/mcp-server --list-tools

# Should output:
# - playwright_run_tests
# - playwright_codegen
# - playwright_show_trace
# - ...
```

### Test GitHub MCP Server

```bash
# Set your token
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token

# List available tools
npx @modelcontextprotocol/server-github --list-tools

# Should output:
# - create_branch
# - create_or_update_file
# - create_pull_request
# - ...
```

## How It Works

The Agentic Playwright framework connects to MCP servers using **stdio transport**:

```typescript
// Playwright MCP connection
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['@playwright/mcp-server'],
});

// GitHub MCP connection
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['@modelcontextprotocol/server-github'],
  env: {
    GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN,
  },
});
```

The framework automatically:
1. Spawns the MCP server process
2. Connects via stdio
3. Calls tools as needed
4. Cleans up connections

## Testing the Integration

Run the validation command to test MCP connectivity:

```bash
npm run validate
```

This will:
- ✅ Validate environment variables
- ✅ Test Playwright MCP connection
- ✅ Test GitHub MCP connection
- ✅ List available tools

## Troubleshooting

### "Command not found: @playwright/mcp-server"

Install the server globally:
```bash
npm install -g @playwright/mcp-server
```

Or ensure npx is working:
```bash
npx --version
```

### "GitHub token not found"

Set the environment variable:
```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token
```

Or add to `.env`:
```env
GITHUB_TOKEN=ghp_your_token
```

### "Connection timeout"

The MCP servers may take a few seconds to start on first run. Wait and retry.

### "Permission denied"

Check that your GitHub token has the required scopes:
- Go to https://github.com/settings/tokens
- Click on your token
- Verify `repo` and `workflow` scopes are checked

## Alternative: Local MCP Server Setup

If you want to run MCP servers as persistent services:

### Playwright MCP Server

```bash
# Start server on port 3000
@playwright/mcp-server --port 3000

# In another terminal, use the framework
npm run agentic -- --feature "Example"
```

### GitHub MCP Server

```bash
# Start server
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx @modelcontextprotocol/server-github

# In another terminal, use the framework
npm run agentic -- --feature "Example"
```

## Resources

- **MCP Specification**: https://modelcontextprotocol.io
- **Playwright MCP**: https://github.com/microsoft/playwright-mcp
- **GitHub MCP**: https://github.com/modelcontextprotocol/servers
- **MCP SDK**: https://github.com/modelcontextprotocol/typescript-sdk

## Summary

1. Install MCP servers: `npm install -g @playwright/mcp-server @modelcontextprotocol/server-github`
2. Set GitHub token: `GITHUB_TOKEN=ghp_xxx` in `.env`
3. Run validation: `npm run validate`
4. Start using: `npm run agentic -- --feature "Your Feature"`

The framework handles all MCP connections automatically! 🎉

