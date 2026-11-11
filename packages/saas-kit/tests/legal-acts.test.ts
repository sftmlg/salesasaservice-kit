import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { loadCatalogue } from "../src/catalogue-data.js";
import { runLiveCommand } from "../src/cli-live.js";
import { SaasClient } from "../src/client.js";
import { ConfirmationRequiredError, LegalActRefusedError } from "../src/errors.js";
import { isLegalAct, isMcpAllowedMutation, MCP_ALLOWED_MUTATIONS } from "../src/legal-acts.js";
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

const catalogued = Object.entries(loadCatalogue().procedures)
  .filter(([, entry]) => entry.kind === "mutation")
  .map(([name]) => name)
  .sort();
const refused = catalogued.filter((name) => !isMcpAllowedMutation(name));
const accepted = catalogued.filter(isMcpAllowedMutation);

const PUBLISHING_FAMILIES = [
  /^listings\.(publish|unpublish|commit)$/,
  /^(opportunities|offers|contracts|commission|subscriptions|verification|onboarding|questionCatalogs)\./,
  /^cookieConsents\.record$/,
  /^workspaceUsers\.remove$/,
  /^salesAgentWaitlistEntries\.createEntry$/,
];

describe("mutation allowlist", () => {
  it("lists exactly the 17 reviewed working mutations (a silently added name would open that write to every agent)", () => {
    expect([...MCP_ALLOWED_MUTATIONS].sort()).toEqual(
      [
        "activities.create",
        "activities.createTask",
        "activities.update",
        "activities.updateTask",
        "activities.updateTaskStatus",
        "companies.create",
        "companies.update",
        "contacts.create",
        "contacts.update",
        "inbox.acknowledge",
        "inbox.acknowledgeProductProposalFailure",
        "listingDefaults.save",
        "listings.update",
        "offerTemplates.create",
        "profile.cancelLogoUpload",
        "profile.completeLogoUpload",
        "profile.startLogoUpload",
      ].sort(),
    );
  });

  it.each(["profile.updateInfo", "profile.updateAddress", "profile.updateUnlimitedPartners"])(
    "keeps %s a legal act (the company's legal statements feed the platform's self-billing, and a later edit does not undo invoices already issued)",
    (name) => {
      expect(isMcpAllowedMutation(name)).toBe(false);
      expect(isLegalAct(name)).toBe(true);
    },
  );

  it.each(["profile.updateInfo", "profile.updateAddress", "profile.updateUnlimitedPartners"])(
    "refuses %s over MCP with confirm=true and legalAct=true and sends nothing (a steered agent must not change the legal data)",
    async (procedure) => {
      const { mcp, calls } = await connectServer();
      const result = await mcp.callTool({
        name: "mutation",
        arguments: { procedure, confirm: true, legalAct: true },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("LEGAL_ACT_REFUSED");
      expect(calls).toHaveLength(0);
    },
  );

  it.each(["profile.updateInfo", "profile.updateAddress", "profile.updateUnlimitedPartners"])(
    "the CLI posts %s only with --confirm --legal-act (the human opt-in must remain possible, or the legal data could not be maintained)",
    async (procedure) => {
      const { deps, calls } = setup();
      await expect(runLiveCommand("mutation", deps, [procedure, "--confirm"])).rejects.toBeInstanceOf(
        LegalActRefusedError,
      );
      await runLiveCommand("mutation", deps, [procedure, "--confirm", "--legal-act"]);
      expect(calls).toHaveLength(1);
    },
  );

  it.each([
    "listings.deleteDraft",
    "products.delete",
    "productProposals.delete",
    "activities.delete",
    "profile.deleteLogo",
    "inbox.acknowledgeFinancial",
  ])(
    "keeps %s a legal act (a delete or a financial acknowledgement is not a reversible working edit)",
    (name) => {
      expect(isMcpAllowedMutation(name)).toBe(false);
      expect(isLegalAct(name)).toBe(true);
    },
  );

  it("allows no name that deletes or acknowledges a financial item (an allowlist described as reversible must hold no delete)", () => {
    expect(MCP_ALLOWED_MUTATIONS.filter((name) => /delete|remove|financial/i.test(name))).toEqual([]);
  });

  it("classifies every catalogued mutation as allowed or refused, and the two sets cover the catalogue (a new catalogued mutation must land on one side)", () => {
    expect(accepted.length + refused.length).toBe(catalogued.length);
    expect(catalogued.every((name) => isMcpAllowedMutation(name) !== isLegalAct(name))).toBe(true);
  });

  it("allows no catalogued name from the publish, accept, reject, sign, send, pay, subscribe, consent, remove or submit families (an allowlist entry for one of them is the bug)", () => {
    const leaked = accepted.filter((name) => PUBLISHING_FAMILIES.some((family) => family.test(name)));
    expect(leaked).toEqual([]);
  });

  it("refuses at least the publishing families it knows are catalogued (an empty refused set would pass the check above for nothing)", () => {
    expect(refused).toEqual(
      expect.arrayContaining(["listings.publish", "offers.send", "workspaceUsers.remove"]),
    );
  });

  it("refuses an unknown name over MCP with the reason and sends nothing (a denylist would have let it through)", async () => {
    const { mcp, calls } = await connectServer();
    const result = await mcp.callTool({
      name: "mutation",
      arguments: { procedure: "totally.unknown", confirm: true },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("LEGAL_ACT_REFUSED");
    expect(JSON.stringify(result.content)).toContain("allowlist");
    expect(calls).toHaveLength(0);
  });

  it.each(["Listings.update", "LISTINGS.UPDATE", "listings.Update", " listings.update", "listings.update "])(
    "refuses the variant %j over MCP (a case or whitespace variant must not match an allowlist entry)",
    async (variant) => {
      const { mcp, calls } = await connectServer();
      const result = await mcp.callTool({
        name: "mutation",
        arguments: { procedure: variant, confirm: true },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("LEGAL_ACT_REFUSED");
      expect(calls).toHaveLength(0);
    },
  );

  describe.each(MCP_ALLOWED_MUTATIONS)("%s", (procedure) => {
    it("is posted over MCP with confirm=true", async () => {
      const { mcp, calls } = await connectServer();
      const result = await mcp.callTool({ name: "mutation", arguments: { procedure, confirm: true } });
      expect(result.isError).not.toBe(true);
      expect(calls).toHaveLength(1);
    });

    it("is still refused over MCP without confirm=true (the allowlist must not replace the confirmation)", async () => {
      const { mcp, calls } = await connectServer();
      const result = await mcp.callTool({ name: "mutation", arguments: { procedure, confirm: false } });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("CONFIRMATION_REQUIRED");
      expect(calls).toHaveLength(0);
    });
  });
});

describe("legal-act guard", () => {
  describe.each(refused)("%s", (procedure) => {
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

  it("refuses a case variant of a refused name in the library (a case variant must not slip past the allowlist)", async () => {
    const { client, calls } = setup();
    await expect(client.mutate("Offers.Send", {}, { confirm: true })).rejects.toBeInstanceOf(
      LegalActRefusedError,
    );
    expect(calls).toHaveLength(0);
  });

  it("refuses an unknown name in the library and the CLI without legalAct (unknown must not mean harmless)", async () => {
    const { client, deps, calls } = setup();
    await expect(client.mutate("totally.unknown", {}, { confirm: true })).rejects.toBeInstanceOf(
      LegalActRefusedError,
    );
    await expect(runLiveCommand("mutation", deps, ["totally.unknown", "--confirm"])).rejects.toBeInstanceOf(
      LegalActRefusedError,
    );
    expect(calls).toHaveLength(0);
  });

  it("does not demand legalAct for an allowlisted mutation (the extra flag must not become mandatory for working mutations)", async () => {
    const { client, deps, calls } = setup();
    await client.mutate("listings.update", {}, { confirm: true });
    await runLiveCommand("mutation", deps, ["listings.update", "--confirm"]);
    expect(calls).toHaveLength(2);
  });
});
