import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadCatalogue } from "../src/catalogue-data.js";
import { isLegalAct, MCP_ALLOWED_MUTATIONS } from "../src/legal-acts.js";

const root = new URL("../../../", import.meta.url);
const reference = readFileSync(new URL("docs/api-reference.md", root), "utf8");
const readme = readFileSync(new URL("README.md", root), "utf8");

function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`${heading}\n`);
  if (start < 0) return "";
  const rest = markdown.slice(start + heading.length);
  const next = rest.search(/\n#{1,6} /);
  return next < 0 ? rest : rest.slice(0, next);
}

function backticked(text: string): string[] {
  return [...text.matchAll(/`([A-Za-z]+\.[A-Za-z*]+)`/g)].map((match) => match[1] ?? "");
}

describe("documented mutation policy equals the typed source", () => {
  it("the allowlist section of the API reference lists exactly MCP_ALLOWED_MUTATIONS (a name added to or dropped from the code but not the docs is the bug)", () => {
    const documented = backticked(section(reference, "### MCP allowlist")).sort();
    expect(documented.length).toBeGreaterThan(0);
    expect(documented).toEqual([...MCP_ALLOWED_MUTATIONS].sort());
  });

  it("every concrete name the reference says is refused is refused in code, and every router wildcard has no allowlisted member (rejectRequest was documented as gated while it was not)", () => {
    const named = backticked(section(reference, "### Everything else"));
    const concrete = named.filter((name) => !name.endsWith("*"));
    const wildcards = named.filter((name) => name.endsWith("*")).map((name) => name.slice(0, -1));
    expect(concrete.length).toBeGreaterThan(0);
    expect(wildcards.length).toBeGreaterThan(0);
    expect(concrete.filter((name) => !isLegalAct(name))).toEqual([]);
    expect(
      MCP_ALLOWED_MUTATIONS.filter((name) => wildcards.some((prefix) => name.startsWith(prefix))),
    ).toEqual([]);
  });

  it("the onboarding paragraph does not call a procedure gated that the code leaves ungated (startWorkspaceVerification was called a legal act while it was ungated)", () => {
    expect(isLegalAct("verification.startWorkspaceVerification")).toBe(true);
    expect(isLegalAct("onboarding.createWorkspace")).toBe(true);
    expect(reference).toContain("Neither is on the MCP allowlist");
  });

  it("states the same allowlist count in the README and the API reference as MCP_ALLOWED_MUTATIONS holds (a count left behind after a name was added or dropped is the bug)", () => {
    const count = String(MCP_ALLOWED_MUTATIONS.length);
    expect(readme.match(/only the (\d+) allowlisted/)?.[1]).toBe(count);
    expect(reference.match(/These (\d+) mutations are accepted over MCP/)?.[1]).toBe(count);
  });

  it("does not claim that a further edit corrects every allowlisted mutation while the inbox read marks have no catalogued undo (a blanket reversibility claim was the bug)", () => {
    expect(reference).not.toMatch(/a further edit corrects it/);
    expect(readme).not.toMatch(/a further edit corrects/);
    for (const text of [section(reference, "### MCP allowlist"), readme]) {
      expect(text).toMatch(/read marks/i);
      expect(text).toMatch(/no catalogued undo/);
    }
  });

  it("the README points to the allowlist section instead of carrying its own list (a second list would drift)", () => {
    expect(readme).toContain("docs/api-reference.md#mcp-allowlist");
    expect(
      readme
        .split("\n")
        .filter((line) => MCP_ALLOWED_MUTATIONS.filter((name) => line.includes(`\`${name}\``)).length > 1),
    ).toEqual([]);
  });

  it("does not say the catalogue fails to confirm the product helper procedures as mutations while it holds them as probed mutations (a stale sentence from before the signed-in refresh)", () => {
    const helpers = [
      "products.extractFromText",
      "products.extractPricing",
      "products.generateShortDescription",
      "products.inspectWebsite",
      "products.suggestClassification",
      "products.startImageUpload",
      "products.completeImageUpload",
    ];
    const procedures = loadCatalogue().procedures;
    expect(helpers.map((name) => procedures[name]?.kind)).toEqual(helpers.map(() => "mutation"));
    expect(helpers.map((name) => procedures[name]?.confirmedBy)).toEqual(helpers.map(() => "get-refused"));
    expect(reference).not.toMatch(/does not even confirm that they are mutations/);
  });

  it("says the input schema of the helper procedures is unknown instead of calling their names unprobed (the names were probed and confirmed, only the input was not observed)", () => {
    expect(reference).not.toMatch(/unprobed/i);
    expect(reference).toMatch(/have an unknown input schema: their names are confirmed by a probe/);
  });

  it("states the questionCatalogs mutation count of the catalogue and refuses every one of them over MCP (a count that differs from the catalogue, or one name left off the refusal, is the bug)", () => {
    const entries = Object.entries(loadCatalogue().procedures).filter(([name]) =>
      name.startsWith("questionCatalogs."),
    );
    const mutations = entries.filter(([, entry]) => entry.kind === "mutation").map(([name]) => name);
    const queries = entries.filter(([, entry]) => entry.kind === "query").map(([name]) => name);
    expect(mutations.length).toBeGreaterThan(0);
    expect(mutations.filter((name) => !isLegalAct(name))).toEqual([]);
    expect(reference).toContain(
      `holds ${entries.length} catalogued names: ${mutations.length} mutations (the GET was refused) and ${queries.length} queries`,
    );
    expect(reference).toContain(`All ${mutations.length} mutations are refused over MCP`);
  });

  it("attributes the VAT id verification statement to the platform's own page text instead of stating it as the kit's measurement (an unattributed claim reads as an observation of an account)", () => {
    const quote = "Mit USt-IdNr. läuft die Verifizierung automatisch, sonst per Ausweisdokument";
    const lines = reference.split("\n").filter((line) => /verif/i.test(line) && /VAT id|USt-IdNr/.test(line));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => !/profile page/i.test(line))).toEqual([]);
    expect(reference).toContain(`"${quote}"`);
  });
});
