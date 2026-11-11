import type { Catalogue } from "./discovery.js";

const STATE_NOTE: Record<string, string> = {
  METHOD_NOT_SUPPORTED: "exists (a GET is refused, so it is a mutation)",
  PRECONDITION_FAILED: "exists, gated until onboarding is complete",
  BAD_REQUEST: "exists, rejects the null input (needs a real input)",
  FORBIDDEN: "exists, refused for the probing account (role or workspace permission)",
  OK: "exists, answers without onboarding",
};

export function renderCatalogue(catalogue: Catalogue): string {
  const routers = new Map<string, [string, Catalogue["procedures"][string]][]>();
  for (const entry of Object.entries(catalogue.procedures)) {
    const router = entry[0].split(".")[0] ?? "";
    routers.set(router, [...(routers.get(router) ?? []), entry]);
  }
  const lines = [
    "# Procedure catalogue",
    "",
    `Generated from \`packages/saas-kit/data/procedures.json\` (measured ${catalogue.measured}). Do not edit by hand; run \`saas-kit docs\`.`,
    "",
    `${Object.keys(catalogue.procedures).length} procedures confirmed by a read-only GET that did not answer \`NOT_FOUND\`.`,
    "",
  ];
  for (const [router, entries] of [...routers].sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(
      `## ${router}`,
      "",
      "| Procedure | Method | Observed answer to GET | Meaning |",
      "| --- | --- | --- | --- |",
    );
    for (const [name, { kind, observed }] of entries) {
      lines.push(
        `| \`${name}\` | ${kind === "query" ? "GET" : "POST"} | \`${observed}\` | ${STATE_NOTE[observed] ?? "see error envelope"} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
