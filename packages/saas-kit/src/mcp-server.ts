#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadCatalogue } from "./catalogue-data.js";
import { loadConfig } from "./config.js";
import { createClient } from "./kit.js";
import { type ToolDeps, tools } from "./tools.js";

async function run<T>(fn: () => Promise<T>) {
  try {
    const value = await fn();
    return { content: [{ type: "text" as const, text: JSON.stringify(value ?? null, null, 2) }] };
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: "text" as const, text: code ? `${code}: ${message}` : message }],
    };
  }
}

export function buildServer(deps: ToolDeps): McpServer {
  const server = new McpServer({ name: "salesasaservice-kit", version: "0.1.0" });
  const procedure = z.string().describe("tRPC procedure as router.procedure, e.g. subscriptions.getStatus");

  server.tool("session_status", "Report whether a platform session exists (user, expiry).", {}, () =>
    run(() => tools.sessionStatus(deps)),
  );
  server.tool("login", "Sign in with the credentials from the environment and store the session.", {}, () =>
    run(() => tools.login(deps)),
  );
  server.tool(
    "discover",
    "Crawl the signed-in app and extract tRPC procedure names and routes from the page bundles (read-only).",
    { paths: z.array(z.string()).optional().describe("extra app paths to crawl, e.g. /de/network") },
    (args) => run(() => tools.discover(deps, args)),
  );
  server.tool(
    "list_procedures",
    "List the bundled catalogue of confirmed procedures with their method and observed state.",
    { router: z.string().optional(), kind: z.enum(["query", "mutation"]).optional() },
    (args) => run(() => tools.listProcedures(deps, args)),
  );
  server.tool(
    "query",
    "Call a tRPC query (HTTP GET, read-only).",
    { procedure, input: z.unknown().optional().describe("JSON input, omit for none") },
    (args) => run(() => tools.query(deps, args)),
  );
  server.tool(
    "mutation",
    "Call a tRPC mutation. WRITES on the platform: confirm must be true, and only after the account holder approved the exact input.",
    {
      procedure,
      input: z.unknown().optional().describe("JSON input"),
      confirm: z.boolean().describe("must be true; anything else is refused"),
    },
    (args) => run(() => tools.mutation(deps, args)),
  );
  return server;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const server = buildServer({ client: createClient(config), config, catalogue: loadCatalogue() });
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
