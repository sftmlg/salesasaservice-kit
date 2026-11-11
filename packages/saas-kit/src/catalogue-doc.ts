import type { Catalogue } from "./discovery.js";

const CONFIRMATION_TEXT = {
  "get-refused": "a GET is refused (405), so it is a mutation",
  "get-answered": "a GET is answered (anything but not found)",
};

export function renderCatalogue(catalogue: Catalogue): string {
  const routers = new Map<string, [string, Catalogue["procedures"][string]][]>();
  for (const entry of Object.entries(catalogue.procedures)) {
    routers.set(entry[1].router, [...(routers.get(entry[1].router) ?? []), entry]);
  }
  const lines = [
    "# Procedure catalogue",
    "",
    `Generated from \`packages/saas-kit/data/procedures.json\` (measured ${catalogue.measured}). Do not edit by hand; run \`saas-kit docs\`.`,
    "",
    `${Object.keys(catalogue.procedures).length} procedures confirmed by a read-only GET that did not answer \`NOT_FOUND\`. The catalogue holds only what is true for every account; what a GET answers for one account on one day is runtime output of \`saas-kit probe\`, explained under "How the catalogue was confirmed" in [api-reference.md](api-reference.md).`,
    "",
  ];
  for (const [router, entries] of [...routers].sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(
      `## ${router}`,
      "",
      "| Procedure | Method | Confirmed by | Note |",
      "| --- | --- | --- | --- |",
    );
    for (const [name, { kind, confirmedBy, note }] of entries) {
      lines.push(
        `| \`${name}\` | ${kind === "query" ? "GET" : "POST"} | ${CONFIRMATION_TEXT[confirmedBy]} | ${note ?? ""} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
