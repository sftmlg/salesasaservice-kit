import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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

  it("the README points to the allowlist section instead of carrying its own list (a second list would drift)", () => {
    expect(readme).toContain("docs/api-reference.md#mcp-allowlist");
    expect(
      readme
        .split("\n")
        .filter((line) => MCP_ALLOWED_MUTATIONS.filter((name) => line.includes(`\`${name}\``)).length > 1),
    ).toEqual([]);
  });
});
