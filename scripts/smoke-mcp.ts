#!/usr/bin/env node

import { getPlaywrightClient } from '../src/mcp/playwrightClient';

async function main() {
  const client = getPlaywrightClient();

  try {
    console.log('Starting Playwright MCP smoke test...');

    const healthy = await client.healthCheck();
    console.log('Playwright MCP health:', healthy);

    // list available tools
    const tools = await client.listTools();
    console.log('Available MCP tools:', tools);

    console.log('Smoke test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Smoke test failed:', error);
    process.exit(1);
  }
}

main();
