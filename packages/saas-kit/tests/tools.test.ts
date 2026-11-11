import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import { ConfirmationRequiredError, NotSignedInError } from "../src/errors.js";
import { tools } from "../src/tools.js";
import { fakeFetch, okReply, proc } from "./helpers.js";

const catalogue = {
  measured: "2026-11-10",
  procedures: {
    "listings.publish": proc("x", "mutation"),
    "listings.list": proc("x", "query"),
    "offers.send": proc("x", "mutation"),
  },
};

function deps(reply: Parameters<typeof fakeFetch>[0], credentials?: { email: string; password: string }) {
  const { fetch, calls } = fakeFetch(reply);
  return {
    calls,
    deps: {
      client: new SaasClient({ baseUrl: "https://x.test", fetch }),
      config: { baseUrl: "https://x.test", sessionFile: undefined, credentials },
      catalogue,
    },
  };
}

describe("tool handlers", () => {
  it("mutation tool refuses without confirm and sends nothing (an agent forgetting confirm must not write)", async () => {
    const { deps: toolDeps, calls } = deps(() => okReply(null));
    await expect(
      tools.mutation(toolDeps, { procedure: "listings.update", input: { id: 1 }, confirm: false }),
    ).rejects.toBeInstanceOf(ConfirmationRequiredError);
    expect(calls).toHaveLength(0);
  });

  it("mutation tool posts when confirmed", async () => {
    const { deps: toolDeps, calls } = deps(() => okReply({ done: true }));
    expect(
      await tools.mutation(toolDeps, { procedure: "listings.update", input: { id: 1 }, confirm: true }),
    ).toEqual({ done: true });
    expect(calls[0]?.method).toBe("POST");
  });

  it("mutation tool without input posts {} (an omitted tool argument means a void-input procedure)", async () => {
    const { deps: toolDeps, calls } = deps(() => okReply(null));
    await tools.mutation(toolDeps, { procedure: "profile.deleteLogo", confirm: true });
    expect(calls[0]?.body).toBe("{}");
  });

  it("query tool uses GET even for a procedure the catalogue lists as mutation (the read tool must never write)", async () => {
    const { deps: toolDeps, calls } = deps(() => okReply(null));
    await tools.query(toolDeps, { procedure: "listings.publish" });
    expect(calls[0]?.method).toBe("GET");
  });

  it("discover tool refuses an API path and sends nothing (the MCP discover must not be a general GET on the platform host)", async () => {
    const { deps: toolDeps, calls } = deps(() => "");
    await expect(tools.discover(toolDeps, { paths: ["/api/auth/sign-out"] })).rejects.toMatchObject({
      code: "NOT_AN_APP_PAGE",
    });
    expect(calls).toHaveLength(0);
  });

  it("list_procedures filters by router and kind", async () => {
    const { deps: toolDeps } = deps(() => "");
    const result = await tools.listProcedures(toolDeps, { router: "listings", kind: "mutation" });
    expect(result.procedures.map((procedure) => procedure.name)).toEqual(["listings.publish"]);
  });

  it("list_procedures router filter matches whole router names (listing must not match listings)", async () => {
    const { deps: toolDeps } = deps(() => "");
    expect((await tools.listProcedures(toolDeps, { router: "listing" })).count).toBe(0);
  });

  it("session_status reports signed out as data, not as an error", async () => {
    const { deps: toolDeps } = deps(() => "null");
    expect(await tools.sessionStatus(toolDeps)).toEqual({ signedIn: false });
  });

  it("session_status reports the active workspace id (the gated queries need it as workspaceId and the kit hid it)", async () => {
    const { deps: toolDeps } = deps(
      () => '{"user":{"email":"a@b.c"},"session":{"expiresAt":"2026-12-01","activeWorkspaceId":"ws_1"}}',
    );
    expect(await tools.sessionStatus(toolDeps)).toMatchObject({ signedIn: true, activeWorkspaceId: "ws_1" });
  });

  it("login without configured credentials explains which variables to set (no sign-in with empty strings)", async () => {
    const { deps: toolDeps, calls } = deps(() => "{}");
    await expect(tools.login(toolDeps)).rejects.toBeInstanceOf(NotSignedInError);
    expect(calls).toHaveLength(0);
  });
});
