import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import {
  buildCatalogue,
  discover,
  extractChunks,
  extractProcedures,
  UNDISCOVERABLE,
} from "../src/discovery.js";
import { fakeFetch, okReply, proc, trpcError } from "./helpers.js";

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
    expect(calls.filter((call) => call.url.endsWith("c.js"))).toHaveLength(1);
  });

  it("records a redirect page and does not parse it (sign-in redirect must read as signed out)", async () => {
    const { fetch } = fakeFetch(() => ({ status: 307, location: "/de/login" }));
    const result = await discover(new SaasClient({ baseUrl: "https://x.test", fetch }), ["/de"]);
    expect(result.pages["/de"]).toBe("307 -> /de/login");
    expect(result.procedures).toEqual({});
  });
});

describe("discovery scope", () => {
  const client = (reply: Parameters<typeof fakeFetch>[0]) => {
    const { fetch, calls } = fakeFetch(reply);
    return { calls, client: new SaasClient({ baseUrl: "https://x.test", fetch }) };
  };

  it.each([
    "/api/auth/sign-out",
    "/api/trpc/listings.publish",
    "/_next/static/a.js",
    "/de/../api/auth/sign-out",
    "/de/./x",
    "/de%2f..%2fapi",
    "//evil.test/de",
    "/dex",
    "/fr",
    "/de?next=/api",
    "/de#x",
    "/",
    "",
  ])(
    "refuses the start path %j and fetches nothing (discover must not GET an arbitrary path on the platform host)",
    async (path) => {
      const { client: saas, calls } = client(() => okReply(null));
      await expect(discover(saas, [path])).rejects.toMatchObject({ code: "NOT_AN_APP_PAGE" });
      expect(calls).toHaveLength(0);
    },
  );

  it.each(["/de", "/en", "/de/", "/en/network", "/de/business-partner/offer-template"])(
    "crawls the app page %j (the restriction must not block the pages discovery exists for)",
    async (path) => {
      const { client: saas, calls } = client(() => "<html></html>");
      await discover(saas, [path]);
      expect(calls.map((call) => call.url)).toContain(`https://x.test${path}`);
    },
  );

  it("does not fetch a chunk link that climbs out of /_next/static (a page could name /api/ through ..)", async () => {
    const { client: saas, calls } = client((req) =>
      req.url.endsWith("/de") ? '<script src="/_next/static/../../api/auth/sign-out.js"></script>' : "",
    );
    await discover(saas, ["/de"]);
    expect(calls.every((call) => !call.url.includes("/api/"))).toBe(true);
  });

  it.each([
    "/_next/static/%2e%2e/%2e%2e/api/auth/sign-out.js",
    "/_next/static/%2E%2E/%2E%2E/api/auth/sign-out.js",
    "/_next/static/%2e./%2E./api/auth/sign-out.js",
    "/_next/static/.%2e/.%2E/api/auth/sign-out.js",
    "/_next/static/%252e%252e/%252e%252e/api/auth/sign-out.js",
    "/_next/static/%25252e%25252e/%25252e%25252e/api/auth/sign-out.js",
    "/_next/static/%2e%2e%2f%2e%2e%2fapi/auth/sign-out.js",
    "/_next/static/..%2f..%2fapi/auth/sign-out.js",
    "/_next/static/..%5c..%5capi/auth/sign-out.js",
    "/_next/static/%2e%2e%5c%2e%2e%5capi/auth/sign-out.js",
    "/_next/static/a/%2e%2e/%2e%2e/api/auth/sign-out.js",
  ])(
    "does not fetch the encoded dot-segment chunk link %j (page text could trigger a signed-in GET outside /_next/static)",
    async (link) => {
      expect(extractChunks(`<script src="${link}"></script>`)).toEqual([]);
      const { client: saas, calls } = client((req) =>
        req.url.endsWith("/de") ? `<script src="${link}"></script>` : "",
      );
      await discover(saas, ["/de"]);
      expect(calls.map((call) => new URL(call.url).pathname)).toEqual(["/de"]);
    },
  );

  it.each([
    "/_next/static/chunks/app-1a2b.js",
    "/_next/static/chunks/pages/%5Bid%5D-9f.js",
    "/_next/static/chunks/a%2db.js",
  ])(
    "still fetches the legitimate chunk %j (the filter must not block the bundles discovery reads)",
    (link) => {
      expect(extractChunks(`<script src="${link}"></script>`)).toEqual([link]);
    },
  );
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
        "offers.send": proc("offers", "mutation"),
        "profile.get": proc("profile", "query"),
      },
    });
  });

  it("catalogues a supplied name by its probe: a refused GET is a mutation, an answer is a query, an unknown name is dropped", async () => {
    const { fetch } = fakeFetch((req) => {
      if (req.url.includes("a.write")) return { status: 405, body: trpcError("METHOD_NOT_SUPPORTED", 405) };
      if (req.url.includes("a.read")) return okReply(1);
      return { status: 404, body: trpcError("NOT_FOUND", 404) };
    });
    const { catalogue, notFound } = await buildCatalogue(
      new SaasClient({ baseUrl: "https://x.test", fetch }),
      {},
      new Date("2026-11-11T10:00:00Z"),
      ["a.write", "a.read", "a.typo"],
    );
    expect(catalogue.procedures).toEqual({
      "a.read": proc("a", "query"),
      "a.write": proc("a", "mutation"),
    });
    expect(notFound).toEqual(["a.typo"]);
  });

  it.each([
    ["a dead session", () => ({ status: 401, body: trpcError("UNAUTHORIZED", 401) })],
    ["a gateway page", () => ({ status: 502, body: "<html>bad gateway</html>" })],
  ])(
    "builds no catalogue when a probe meets %s (a failed probe must not be stored as a confirmed procedure)",
    async (_label, reply) => {
      const { fetch } = fakeFetch(reply);
      await expect(
        buildCatalogue(new SaasClient({ baseUrl: "https://x.test", fetch }), { "a.b": "query" }),
      ).rejects.toMatchObject({ code: "PROBE_FAILED" });
    },
  );

  it("builds no catalogue from an empty crawl (a redirect to login must not wipe the stored catalogue)", async () => {
    const { fetch } = fakeFetch(() => okReply(1));
    await expect(
      buildCatalogue(new SaasClient({ baseUrl: "https://x.test", fetch }), {}),
    ).rejects.toMatchObject({ code: "NOTHING_TO_PROBE" });
  });

  it("trusts a refused GET over the bundle guess: a name the bundle showed as query is a mutation (docs would map it to GET)", async () => {
    const { fetch } = fakeFetch(() => ({ status: 405, body: trpcError("METHOD_NOT_SUPPORTED", 405) }));
    const { catalogue } = await buildCatalogue(new SaasClient({ baseUrl: "https://x.test", fetch }), {
      "a.b": "query",
    });
    expect(catalogue.procedures["a.b"]?.kind).toBe("mutation");
  });

  it("stores no probe answer in the catalogue (PRECONDITION_FAILED is one account's state on one day, not a property of the procedure)", async () => {
    const { fetch } = fakeFetch((req) =>
      req.url.includes("a.gated")
        ? { status: 412, body: trpcError("PRECONDITION_FAILED", 412) }
        : { status: 405, body: trpcError("METHOD_NOT_SUPPORTED", 405) },
    );
    const { catalogue } = await buildCatalogue(new SaasClient({ baseUrl: "https://x.test", fetch }), {
      "a.gated": "query",
      "a.write": "mutation",
    });
    expect(JSON.stringify(catalogue)).not.toMatch(/PRECONDITION_FAILED|METHOD_NOT_SUPPORTED|observed/);
    expect(catalogue.procedures["a.gated"]).toEqual({
      router: "a",
      kind: "query",
      confirmedBy: "get-answered",
    });
    expect(catalogue.procedures["a.write"]?.confirmedBy).toBe("get-refused");
  });

  it("carries the discovery note on a name the crawl cannot see (onboarding.createWorkspace would read as a normal discovered procedure)", async () => {
    const { fetch } = fakeFetch(() => ({ status: 405, body: trpcError("METHOD_NOT_SUPPORTED", 405) }));
    const { catalogue } = await buildCatalogue(
      new SaasClient({ baseUrl: "https://x.test", fetch }),
      { "a.b": "query" },
      new Date(),
      Object.keys(UNDISCOVERABLE),
    );
    expect(catalogue.procedures["onboarding.createWorkspace"]).toMatchObject({
      kind: "mutation",
      note: expect.stringContaining("Discovery cannot see it"),
    });
    expect(catalogue.procedures["a.b"]?.note).toBeUndefined();
  });

  it("probes with GET only, so discovery can never write", async () => {
    const { fetch, calls } = fakeFetch(() => okReply(1));
    await buildCatalogue(new SaasClient({ baseUrl: "https://x.test", fetch }), { "a.b": "mutation" });
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });
});

describe("route extraction", () => {
  it("prefixes locale-less href routes with /de and skips api and asset paths (otherwise the crawl requests /api/* or 404s)", async () => {
    const { extractRoutes } = await import("../src/discovery.js");
    const routes = extractRoutes(
      'href:"/business-partner/offer-template", push("/api/trpc"), "/de/network/", href:"/_next/x"',
    );
    expect(routes).toContain("/de/business-partner/offer-template");
    expect(routes).toContain("/de/network");
    expect(routes.some((route) => route.includes("api") || route.includes("_next"))).toBe(false);
  });
});
