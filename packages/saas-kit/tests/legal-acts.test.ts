import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { runLiveCommand } from "../src/cli-live.js";
import { SaasClient } from "../src/client.js";
import { ConfirmationRequiredError, LegalActRefusedError } from "../src/errors.js";
import { LEGAL_ACT_PROCEDURES } from "../src/legal-acts.js";
import { buildServer } from "../src/server.js";
import { fakeFetch, okReply } from "./helpers.js";

const catalogue = { measured: "d", procedures: {} };
const config = { baseUrl: "https://x.test", sessionFile: undefined, credentials: undefined };

function setup() {
  const { fetch, calls } = fakeFetch(() => okReply({ done: true }));
  const client = new SaasClient({ baseUrl: "https://x.test", fetch });
  return { client, calls, deps: { client, config, catalogue } };
}

async function connectServer() {
  const { deps, calls } = setup();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test", version: "0" });
  await Promise.all([buildServer(deps).connect(serverSide), mcp.connect(clientSide)]);
  return { mcp, calls };
}

describe("legal-act guard", () => {
  it("lists exactly the ten legal-act procedures (a dropped entry silently re-opens that act to agents)", () => {
    expect([...LEGAL_ACT_PROCEDURES].sort()).toEqual([
      "commission.confirmBusinessDetails",
      "commission.requestPayout",
      "commission.updateBankDetails",
      "contracts.signWorkspaceContract",
      "offers.send",
      "onboarding.createWorkspace",
      "opportunities.acceptClose",
      "opportunities.acceptRequest",
      "opportunities.rejectClose",
      "subscriptions.createCheckout",
    ]);
  });

  describe.each(LEGAL_ACT_PROCEDURES)("%s", (procedure) => {
    it("client.mutate with confirm=true but no legalAct is refused and sends nothing (confirm alone is set by an agent)", async () => {
      const { client, calls } = setup();
      await expect(client.mutate(procedure, {}, { confirm: true })).rejects.toBeInstanceOf(
        LegalActRefusedError,
      );
      expect(calls).toHaveLength(0);
    });

    it("client.mutate with legalAct=true but confirm=false is still refused (the two flags are independent)", async () => {
      const { client, calls } = setup();
      await expect(client.mutate(procedure, {}, { confirm: false, legalAct: true })).rejects.toBeInstanceOf(
        ConfirmationRequiredError,
      );
      expect(calls).toHaveLength(0);
    });

    it("client.mutate posts when both confirm and legalAct are true", async () => {
      const { client, calls } = setup();
      await client.mutate(procedure, {}, { confirm: true, legalAct: true });
      expect(calls[0]?.method).toBe("POST");
    });

    it("the MCP mutation tool refuses it with LEGAL_ACT_REFUSED and the reason, even when the agent adds legalAct=true", async () => {
      const { mcp, calls } = await connectServer();
      const result = await mcp.callTool({
        name: "mutation",
        arguments: { procedure, confirm: true, legalAct: true },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("LEGAL_ACT_REFUSED");
      expect(JSON.stringify(result.content)).toContain("steer an agent");
      expect(calls).toHaveLength(0);
    });

    it("the CLI refuses --confirm alone and sends nothing", async () => {
      const { deps, calls } = setup();
      await expect(runLiveCommand("mutation", deps, [procedure, "--confirm"])).rejects.toBeInstanceOf(
        LegalActRefusedError,
      );
      expect(calls).toHaveLength(0);
    });

    it("the CLI accepts --confirm --legal-act", async () => {
      const { deps, calls } = setup();
      await runLiveCommand("mutation", deps, [procedure, "--confirm", "--legal-act"]);
      expect(calls).toHaveLength(1);
    });
  });

  it("the CLI refuses --legal-act without --confirm (the extra flag must not replace the confirmation)", async () => {
    const { deps, calls } = setup();
    await expect(runLiveCommand("mutation", deps, ["offers.send", "--legal-act"])).rejects.toBeInstanceOf(
      ConfirmationRequiredError,
    );
    expect(calls).toHaveLength(0);
  });

  it("matches the procedure name case-insensitively (a case variant must not slip past the list)", async () => {
    const { client, calls } = setup();
    await expect(client.mutate("Offers.Send", {}, { confirm: true })).rejects.toBeInstanceOf(
      LegalActRefusedError,
    );
    expect(calls).toHaveLength(0);
  });

  it("does not block an ordinary mutation (the guard must not turn every write into a legal act)", async () => {
    const { client, calls } = setup();
    await client.mutate("listings.publish", {}, { confirm: true });
    expect(calls).toHaveLength(1);
  });
});
