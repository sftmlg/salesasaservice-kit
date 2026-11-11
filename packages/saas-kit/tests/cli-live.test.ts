import { describe, expect, it } from "vitest";
import { runLiveCommand } from "../src/cli-live.js";
import { SaasClient } from "../src/client.js";
import { ConfigError, ConfirmationRequiredError } from "../src/errors.js";
import { fakeFetch, okReply, proc, trpcError } from "./helpers.js";

const catalogue = {
  measured: "2026-11-11",
  procedures: {
    "a.read": proc("a", "query"),
    "a.write": proc("x", "mutation"),
  },
};

function setup(reply: Parameters<typeof fakeFetch>[0]) {
  const { fetch, calls } = fakeFetch(reply);
  return {
    calls,
    deps: {
      client: new SaasClient({ baseUrl: "https://x.test", fetch }),
      config: { baseUrl: "https://x.test", sessionFile: undefined, credentials: undefined },
      catalogue,
    },
  };
}

describe("live CLI commands", () => {
  it("mutation without --confirm is refused and sends nothing (a typed command must not write by default)", async () => {
    const { deps, calls } = setup(() => okReply(null));
    await expect(runLiveCommand("mutation", deps, ["listings.update", '{"x":1}'])).rejects.toBeInstanceOf(
      ConfirmationRequiredError,
    );
    expect(calls).toHaveLength(0);
  });

  it("mutation --confirm without json posts {} (a void-input procedure rejects a {0:null} body)", async () => {
    const { deps, calls } = setup(() => okReply({ success: true }));
    await runLiveCommand("mutation", deps, ["listings.update", "--confirm"]);
    expect(calls[0]?.body).toBe("{}");
  });

  it("mutation --confirm with json posts it under key 0", async () => {
    const { deps, calls } = setup(() => okReply({ success: true }));
    await runLiveCommand("mutation", deps, ["listings.update", '{"city":"Innsbruck"}', "--confirm"]);
    expect(JSON.parse(calls[0]?.body ?? "")).toEqual({ 0: { city: "Innsbruck" } });
  });

  it("query with malformed json fails before any request (a typo must not probe with a wrong input)", async () => {
    const { deps, calls } = setup(() => okReply(null));
    await expect(runLiveCommand("query", deps, ["a.read", "{oops"])).rejects.toBeInstanceOf(ConfigError);
    expect(calls).toHaveLength(0);
  });

  it("probe uses GET for every catalogued procedure, mutations included, and counts the answers", async () => {
    const { deps, calls } = setup((req) =>
      req.url.includes("a.write") ? trpcError("METHOD_NOT_SUPPORTED", 405) : okReply({}),
    );
    const result = (await runLiveCommand("probe", deps, [])) as {
      count: number;
      summary: Record<string, number>;
    };
    expect(calls.map((call) => call.method)).toEqual(["GET", "GET"]);
    expect(result.count).toBe(2);
    expect(result.summary).toEqual({ OK: 1, METHOD_NOT_SUPPORTED: 1 });
  });

  it("list rejects an unknown kind instead of silently returning everything", async () => {
    const { deps } = setup(() => "");
    await expect(runLiveCommand("list", deps, ["--kind", "write"])).rejects.toBeInstanceOf(ConfigError);
  });
});
