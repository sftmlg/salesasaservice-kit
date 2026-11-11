import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import { buildCatalogue, discover, extractChunks, extractProcedures } from "../src/discovery.js";
import { fakeFetch, ok, trpcError } from "./helpers.js";

describe("procedure extraction", () => {
  it("classifies mutationOptions/useMutation as mutations and the rest as queries", () => {
    const found = extractProcedures(
      "t.listings.publish.mutationOptions(); t.profile.get.queryOptions(); x.a.b.useMutation()",
    );
    expect(found).toEqual({ "listings.publish": "mutation", "profile.get": "query", "a.b": "mutation" });
  });

  it("keeps the first kind seen (a later queryKey reference must not turn a mutation into a query)", () => {
    expect(extractProcedures("t.a.b.mutationOptions(); t.a.b.queryKey()")["a.b"]).toBe("mutation");
  });

  it("collects chunk URLs once", () => {
    expect(
      extractChunks('<script src="/_next/static/a.js"></script><script src="/_next/static/a.js">'),
    ).toEqual(["/_next/static/a.js"]);
  });
});

describe("discovery crawl", () => {
  it("follows chunks referenced by pages and does not fetch one twice", async () => {
    const { fetch, calls } = fakeFetch((req) => {
      if (req.url.endsWith("/de")) return '<script src="/_next/static/c.js"></script>';
      if (req.url.endsWith("/de/network")) return '<script src="/_next/static/c.js"></script>';
      return "t.offers.send.mutationOptions()";
    });
    const result = await discover(new SaasClient({ baseUrl: "https://x.test", fetch }), [
      "/de",
      "/de/network",
    ]);
    expect(result.procedures).toEqual({ "offers.send": "mutation" });
    expect(calls.filter((c) => c.url.endsWith("c.js"))).toHaveLength(1);
  });

  it("records a redirect page and does not parse it (sign-in redirect must read as signed out)", async () => {
    const { fetch } = fakeFetch(() => ({ status: 307, location: "/de/login" }));
    const result = await discover(new SaasClient({ baseUrl: "https://x.test", fetch }), ["/de"]);
    expect(result.pages["/de"]).toBe("307 -> /de/login");
    expect(result.procedures).toEqual({});
  });
});

describe("catalogue building", () => {
  it("drops NOT_FOUND names (bundle noise) and keeps gated and unsupported ones with their state", async () => {
    const { fetch } = fakeFetch((req) => {
      if (req.url.includes("d.commission")) return { status: 404, body: trpcError("NOT_FOUND", 404) };
      if (req.url.includes("profile.get"))
        return { status: 412, body: trpcError("PRECONDITION_FAILED", 412) };
      return { status: 405, body: trpcError("METHOD_NOT_SUPPORTED", 405) };
    });
    const { catalogue, notFound } = await buildCatalogue(
      new SaasClient({ baseUrl: "https://x.test", fetch }),
      { "d.commission": "query", "profile.get": "query", "offers.send": "mutation" },
      new Date("2026-11-11T10:00:00Z"),
    );
    expect(notFound).toEqual(["d.commission"]);
    expect(catalogue).toEqual({
      measured: "2026-11-11",
      procedures: {
        "offers.send": { kind: "mutation", observed: "METHOD_NOT_SUPPORTED" },
        "profile.get": { kind: "query", observed: "PRECONDITION_FAILED" },
      },
    });
  });

  it("probes with GET only, so discovery can never write", async () => {
    const { fetch, calls } = fakeFetch(() => ok(1));
    await buildCatalogue(new SaasClient({ baseUrl: "https://x.test", fetch }), { "a.b": "mutation" });
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });
});
