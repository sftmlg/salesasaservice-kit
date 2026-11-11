import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const requireFromHere = createRequire(import.meta.url);
const packageSchema = z.object({ version: z.string() });

function installedVersion(name: string, from: string): number[] | undefined {
  let file: string;
  try {
    file = createRequire(from).resolve(`${name}/package.json`);
  } catch {
    return undefined;
  }
  return packageSchema
    .parse(JSON.parse(readFileSync(file, "utf8")))
    .version.split(".")
    .map((part) => Number.parseInt(part, 10));
}

function atLeast(actual: number[] | undefined, floor: number[]): boolean {
  if (!actual) return false;
  for (const [index, part] of floor.entries()) {
    const have = actual[index] ?? 0;
    if (have !== part) return have > part;
  }
  return true;
}

const vitestPackage = requireFromHere.resolve("vitest/package.json");

describe("dependency floors (versions below these carry published advisories)", () => {
  it("vitest is at least 4.1.12 (GHSA-5xrq-8626-4rwp, GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8)", () => {
    expect(atLeast(installedVersion("vitest", import.meta.url), [4, 1, 12])).toBe(true);
  });

  it("the vite that vitest runs on is at least 6.4.4 (high: GHSA-587h-7wmj-h5pm)", () => {
    expect(atLeast(installedVersion("vite", vitestPackage), [6, 4, 4])).toBe(true);
  });

  it("the test runner pulls in no tinypool below 2.1.2 (critical: GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr)", () => {
    const tinypool = installedVersion("tinypool", vitestPackage);
    expect(tinypool === undefined || atLeast(tinypool, [2, 1, 2])).toBe(true);
  });

  it("the floor check can fail: a version below the floor is reported as below", () => {
    expect(atLeast([4, 1, 11], [4, 1, 12])).toBe(false);
    expect(atLeast([3, 99, 99], [4, 1, 12])).toBe(false);
    expect(atLeast(undefined, [4, 1, 12])).toBe(false);
  });
});
