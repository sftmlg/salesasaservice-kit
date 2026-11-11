#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadCatalogue } from "./catalogue-data.js";
import { loadConfig } from "./config.js";
import { createClient } from "./kit.js";
import { printErrorLine } from "./output.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = buildServer({ client: createClient(config), config, catalogue: loadCatalogue() });
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  printErrorLine(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
