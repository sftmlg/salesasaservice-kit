import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { ConfigError } from "../src/errors.js";

const dir = mkdtempSync(join(tmpdir(), "saas-cfg-"));

describe("config", () => {
  it("reads credentials from the file named by the environment variable", () => {
    const file = join(dir, "c.json");
    writeFileSync(file, JSON.stringify({ email: "a@b.c", password: "pw" }));
    expect(loadConfig({ SAAS_CREDENTIALS_FILE: file }).credentials).toEqual({
      email: "a@b.c",
      password: "pw",
    });
  });

  it("prefers the credentials file over loose variables (two sources must not be merged)", () => {
    const file = join(dir, "c2.json");
    writeFileSync(file, JSON.stringify({ email: "file@x", password: "f" }));
    expect(
      loadConfig({ SAAS_CREDENTIALS_FILE: file, SAAS_EMAIL: "env@x", SAAS_PASSWORD: "e" }).credentials?.email,
    ).toBe("file@x");
  });

  it("rejects a credentials file without a password instead of signing in with undefined", () => {
    const file = join(dir, "c3.json");
    writeFileSync(file, JSON.stringify({ email: "a@b.c" }));
    expect(() => loadConfig({ SAAS_CREDENTIALS_FILE: file })).toThrow(ConfigError);
  });

  it("reports a missing credentials file as a config error naming the variable", () => {
    expect(() => loadConfig({ SAAS_CREDENTIALS_FILE: join(dir, "missing.json") })).toThrow(
      /SAAS_CREDENTIALS_FILE/,
    );
  });

  it("has no credentials when nothing is configured and strips a trailing slash from the base URL", () => {
    const cfg = loadConfig({ SAAS_BASE_URL: "https://x.test//" });
    expect(cfg.credentials).toBeUndefined();
    expect(cfg.baseUrl).toBe("https://x.test");
  });

  it("needs both loose variables (an email alone is not a login)", () => {
    expect(loadConfig({ SAAS_EMAIL: "a@b.c" }).credentials).toBeUndefined();
  });
});
