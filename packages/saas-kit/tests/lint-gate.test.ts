import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const scratchDir = join(repoRoot, "packages/saas-kit/tests/scratch-lint-gate");

const reportSchema = z.object({
  diagnostics: z.array(z.object({ category: z.string(), message: z.string() })),
});

function lintScratch(source: string) {
  mkdirSync(scratchDir, { recursive: true });
  const file = join(scratchDir, "probe.ts");
  writeFileSync(file, source);
  const run = spawnSync("pnpm", ["exec", "biome", "lint", file, "--reporter=json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  expect(run.error, "biome could not be started, so the gate cannot look").toBeUndefined();
  const jsonStart = run.stdout.indexOf("{");
  expect(jsonStart, `biome printed no report: ${run.stderr}`).toBeGreaterThanOrEqual(0);
  return reportSchema.parse(JSON.parse(run.stdout.slice(jsonStart))).diagnostics;
}

describe("lint gate", () => {
  afterEach(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  it("reports a one-letter binding through the short-identifier plugin, so the plugin cannot go blind", () => {
    const diagnostics = lintScratch("export const x = 1;\n");
    expect(diagnostics.filter((entry) => entry.category === "plugin")).toEqual([
      expect.objectContaining({ message: expect.stringContaining("shorter than three characters") }),
    ]);
  });

  it("reports a binding with a leading underscore through the plugin", () => {
    const diagnostics = lintScratch("export const _hidden = 1;\n");
    expect(diagnostics.map((entry) => entry.message)).toContainEqual(
      expect.stringContaining("leading underscore"),
    );
  });

  it("reports nothing on a well-named file, so the positive cases are not an always-red gate", () => {
    expect(lintScratch("export const total = 1;\n")).toEqual([]);
  });
});
