import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import { buildServer } from "../src/server.js";
import { fakeFetch, okReply } from "./helpers.js";

async function connect(reply: Parameters<typeof fakeFetch>[0]) {
  const { fetch, calls } = fakeFetch(reply);
  const server = buildServer({
    client: new SaasClient({ baseUrl: "https://x.test", fetch }),
    config: { baseUrl: "https://x.test", sessionFile: undefined, credentials: undefined },
    catalogue: { measured: "d", procedures: {} },
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return { client, calls };
}

function textOf(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const first = Array.isArray(result.content) ? result.content[0] : undefined;
  return first && "text" in first ? String(first.text) : "";
}

describe("MCP server wiring", () => {
  it("exposes exactly the documented tools and no account creation (sign-up accepts terms for a person)", async () => {
    const { client } = await connect(() => okReply(null));
    const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
    expect(names).toEqual(["discover", "list_procedures", "login", "mutation", "query", "session_status"]);
  });

  it("answers an unconfirmed mutation with CONFIRMATION_REQUIRED as a tool error and sends nothing", async () => {
    const { client, calls } = await connect(() => okReply(null));
    const result = await client.callTool({
      name: "mutation",
      arguments: { procedure: "listings.publish", confirm: false },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("CONFIRMATION_REQUIRED");
    expect(calls).toHaveLength(0);
  });

  it("refuses a non-boolean confirm and sends nothing (the string 'true' must not authorise a write)", async () => {
    const { client, calls } = await connect(() => okReply(null));
    const result = await client.callTool({
      name: "mutation",
      arguments: { procedure: "listings.publish", confirm: "true" },
    });
    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});
