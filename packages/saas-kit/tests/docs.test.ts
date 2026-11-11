import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCatalogue } from "../src/catalogue-data.js";
import { renderCatalogue } from "../src/catalogue-doc.js";
import { buildOpenApi } from "../src/openapi.js";
import { proc } from "./helpers.js";

const root = new URL("../../../docs/", import.meta.url);
const catalogue = loadCatalogue();

describe("generated documentation", () => {
  it("openapi.json in docs/ equals the generator output (edited or stale file would drift from the catalogue)", () => {
    const committed = JSON.parse(readFileSync(new URL("openapi.json", root), "utf8"));
    expect(committed).toEqual(
      JSON.parse(JSON.stringify(buildOpenApi(catalogue, "https://www.salesasaservice.at"))),
    );
  });

  it("procedure-catalogue.md in docs/ equals the renderer output", () => {
    expect(readFileSync(new URL("procedure-catalogue.md", root), "utf8")).toBe(renderCatalogue(catalogue));
  });

  it("maps queries to GET and mutations to POST (a mutation exposed as GET would be probed as a write)", () => {
    const doc = buildOpenApi(
      {
        measured: "d",
        procedures: {
          "a.q": proc("a", "query"),
          "a.m": proc("a", "mutation"),
        },
      },
      "https://x.test",
    ) as { paths: Record<string, object> };
    expect(Object.keys(doc.paths["/api/trpc/a.q"] ?? {})).toEqual(["get"]);
    expect(Object.keys(doc.paths["/api/trpc/a.m"] ?? {})).toEqual(["post"]);
  });

  it("groups the catalogue by router with one row per procedure", () => {
    const page = renderCatalogue({
      measured: "d",
      procedures: {
        "a.q": proc("a", "query"),
        "b.m": proc("b", "mutation"),
      },
    });
    expect(page).toContain("## a");
    expect(page).toContain("## b");
    expect(page).toContain("| `b.m` | POST | a GET is refused (405), so it is a mutation |");
  });

  it("refuses a catalogue file with an unknown procedure kind (generated docs would silently map it to GET)", () => {
    const file = join(mkdtempSync(join(tmpdir(), "saas-")), "procedures.json");
    writeFileSync(
      file,
      JSON.stringify({
        measured: "d",
        procedures: { "a.b": { router: "a", kind: "patch", confirmedBy: "get-answered" } },
      }),
    );
    expect(() => loadCatalogue(pathToFileURL(file))).toThrow();
  });

  it("does not leak any credential-looking or personal data into the bundled catalogue", () => {
    expect(JSON.stringify(catalogue)).not.toMatch(/@|password|token/i);
  });
});

describe("products page catalogue entries", () => {
  const productsPage = [
    "listings.create",
    "products.create",
    "products.update",
    "products.completeImageUpload",
    "products.startImageUpload",
    "products.extractFromText",
    "products.extractPricing",
    "products.generateShortDescription",
    "products.inspectWebsite",
    "products.suggestClassification",
    "productProposals.accept",
    "questionCatalogs.getCatalogForProduct",
  ];

  it("has probed every name that only the products page references (an unprobed entry left after a signed-in refresh means the refresh did not run)", () => {
    const stillUnprobed = productsPage.filter(
      (name) =>
        catalogue.procedures[name]?.confirmedBy !== "get-refused" &&
        catalogue.procedures[name]?.confirmedBy !== "get-answered",
    );
    expect(stillUnprobed).toEqual([]);
  });

  it("confirms the eleven mutations by a refused GET and the query by an answered GET (the kind comes from the platform answer, not from the name)", () => {
    const confirmation = Object.fromEntries(
      productsPage.map((name) => [name, catalogue.procedures[name]?.confirmedBy]),
    );
    expect(confirmation["questionCatalogs.getCatalogForProduct"]).toBe("get-answered");
    expect(productsPage.filter((name) => confirmation[name] === "get-refused")).toHaveLength(
      productsPage.length - 1,
    );
  });

  it("marks the one read as a query and the rest as mutations (a write catalogued as query would be sent as a GET)", () => {
    const kinds = Object.fromEntries(productsPage.map((name) => [name, catalogue.procedures[name]?.kind]));
    expect(kinds["questionCatalogs.getCatalogForProduct"]).toBe("query");
    expect(productsPage.filter((name) => kinds[name] === "mutation")).toHaveLength(productsPage.length - 1);
  });

  it("renders an unprobed entry as not yet probed and counts it apart from probed ones (the header must not call it confirmed)", () => {
    const page = renderCatalogue({
      measured: "d",
      procedures: {
        "a.q": proc("a", "query"),
        "a.n": { router: "a", kind: "mutation", confirmedBy: "unprobed" },
      },
    });
    expect(page).toContain("| `a.n` | POST | named by a page of the app, not yet probed |");
    expect(page).toContain("2 procedures, 1 confirmed by a read-only GET");
    expect(page).toContain("1 named by a page of the app but not yet probed");
  });
});

describe("catalogue file", () => {
  it("refuses an entry that carries a probe answer (a per-account result would be shipped as a fact for every user)", () => {
    const file = join(mkdtempSync(join(tmpdir(), "saas-")), "procedures.json");
    writeFileSync(
      file,
      JSON.stringify({
        measured: "d",
        procedures: {
          "a.b": {
            router: "a",
            kind: "mutation",
            confirmedBy: "get-refused",
            observed: "METHOD_NOT_SUPPORTED",
          },
        },
      }),
    );
    expect(() => loadCatalogue(pathToFileURL(file))).toThrow();
  });
});

describe("api reference", () => {
  it("names only procedures that exist in the catalogue (a documented schema for a misspelled or removed procedure misleads callers)", () => {
    const text = readFileSync(new URL("api-reference.md", root), "utf8");
    const routers = new Set(Object.values(catalogue.procedures).map((entry) => entry.router));
    const mentioned = [...text.matchAll(/`([a-zA-Z]+\.[a-zA-Z]+)`/g)]
      .map((match) => match[1] ?? "")
      .filter((name) => routers.has(name.split(".")[0] ?? ""));
    expect(mentioned.length).toBeGreaterThan(10);
    expect(mentioned.filter((name) => !(name in catalogue.procedures))).toEqual([]);
  });

  it.each([
    ["a date of a call", /\b20\d\d-\d\d-\d\d\b/],
    ["the account owner", /account owner/i],
    ["an empty result of one account", /`\[\]`|"items":\[\]/],
    ["the role of the probing account", /has: [a-z_]+/],
  ])("describes platform behaviour, not the state of one account (found %s)", (_label, pattern) => {
    const text = readFileSync(new URL("api-reference.md", root), "utf8");
    expect(text).not.toMatch(pattern);
  });
});
