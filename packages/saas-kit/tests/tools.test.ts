import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import { ConfirmationRequiredError, NotSignedInError } from "../src/errors.js";
import { tools } from "../src/tools.js";
import { fakeFetch, ok } from "./helpers.js";

const catalogue = {
  measured: "2026-11-10",
  procedures: {
    "listings.publish": { kind: "mutation" as const, observed: "METHOD_NOT_SUPPORTED" },
    "listings.list": { kind: "query" as const, observed: "PRECONDITION_FAILED" },
    "offers.send": { kind: "mutation" as const, observed: "METHOD_NOT_SUPPORTED" },
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
    const { deps: d, calls } = deps(() => ok(null));
    await expect(
      tools.mutation(d, { procedure: "listings.publish", input: { id: 1 }, confirm: false }),
    ).rejects.toBeInstanceOf(ConfirmationRequiredError);
    expect(calls).toHaveLength(0);
  });

  it("mutation tool posts when confirmed", async () => {
    const { deps: d, calls } = deps(() => ok({ done: true }));
    expect(
      await tools.mutation(d, { procedure: "listings.publish", input: { id: 1 }, confirm: true }),
    ).toEqual({ done: true });
    expect(calls[0]?.method).toBe("POST");
  });

  it("mutation tool without input posts {} (an omitted tool argument means a void-input procedure)", async () => {
    const { deps: d, calls } = deps(() => ok(null));
    await tools.mutation(d, { procedure: "verification.startWorkspaceVerification", confirm: true });
    expect(calls[0]?.body).toBe("{}");
  });

  it("query tool uses GET even for a procedure the catalogue lists as mutation (the read tool must never write)", async () => {
    const { deps: d, calls } = deps(() => ok(null));
    await tools.query(d, { procedure: "listings.publish" });
    expect(calls[0]?.method).toBe("GET");
  });

  it("list_procedures filters by router and kind", async () => {
    const { deps: d } = deps(() => "");
    const r = await tools.listProcedures(d, { router: "listings", kind: "mutation" });
    expect(r.procedures.map((p) => p.name)).toEqual(["listings.publish"]);
  });

  it("list_procedures router filter matches whole router names (listing must not match listings)", async () => {
    const { deps: d } = deps(() => "");
    expect((await tools.listProcedures(d, { router: "listing" })).count).toBe(0);
  });

  it("session_status reports signed out as data, not as an error", async () => {
    const { deps: d } = deps(() => "null");
    expect(await tools.sessionStatus(d)).toEqual({ signedIn: false });
  });

  it("login without configured credentials explains which variables to set (no sign-in with empty strings)", async () => {
    const { deps: d, calls } = deps(() => "{}");
    await expect(tools.login(d)).rejects.toBeInstanceOf(NotSignedInError);
    expect(calls).toHaveLength(0);
  });
});
