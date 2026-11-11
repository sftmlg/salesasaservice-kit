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
