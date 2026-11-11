import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SaasError } from "./errors.js";
import { type ToolDeps, tools } from "./tools.js";

async function run<T>(task: () => Promise<T>) {
  try {
    const value = await task();
    return { content: [{ type: "text" as const, text: JSON.stringify(value ?? null, null, 2) }] };
  } catch (error) {
    const code = error instanceof SaasError ? error.code : undefined;
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
    "List the bundled catalogue of confirmed procedures with their router, method and how each was confirmed.",
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
    "Call a tRPC mutation. WRITES on the platform: confirm must be true, and only after the account holder approved the exact input. Only the reviewed, reversible working mutations on the allowlist are accepted; every other name (publishing, accepting, rejecting, signing, sending, paying, subscribing, consenting, removing users, submitting, or unknown) is refused here and needs the CLI with --legal-act.",
    {
      procedure,
      input: z.unknown().optional().describe("JSON input"),
      confirm: z.boolean().describe("must be true; anything else is refused"),
    },
    (args) =>
      run(() =>
        tools.mutation(deps, { procedure: args.procedure, input: args.input, confirm: args.confirm }),
      ),
  );
  return server;
}
