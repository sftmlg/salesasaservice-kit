import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import { loadConfig } from "../src/config.js";
import { FileSessionStore } from "../src/session-store.js";
import { fakeFetch } from "./helpers.js";

const SECRET = "PLANTED-SECRET-7f3a9c";
const dir = mkdtempSync(join(tmpdir(), "saas-leak-"));

function thrown(task: () => unknown): unknown {
  try {
    task();
  } catch (error) {
    return error;
  }
  throw new Error("expected the task to throw");
}

function expectNoSecret(error: unknown) {
  expect(error).toBeInstanceOf(Error);
  expect(inspect(error, { depth: 10 })).not.toContain(SECRET);
}

describe("secrets in error text", () => {
  it.each([SECRET, `{"password":"${SECRET}"`, `{"email":"a@b.c","password":"${SECRET}" oops}`])(
    "a malformed credentials file %# reports only the file kind (the parser message quotes the content on Node 26)",
    (content) => {
      const file = join(dir, "credentials.json");
      writeFileSync(file, content);
      const error = thrown(() => loadConfig({ SAAS_CREDENTIALS_FILE: file }));
      expectNoSecret(error);
      expect(error).toHaveProperty("message", "malformed JSON in the credentials file");
    },
  );

  it.each([SECRET, `{"cookies":{"session":"${SECRET}"`, `{"cookies":{"session":"${SECRET}"} oops}`])(
    "a malformed session file %# reports only the file kind (the parser message quotes the cookie on Node 26)",
    (content) => {
      const file = join(dir, "session.json");
      writeFileSync(file, content);
      const error = thrown(() => new FileSessionStore(file).load());
      expectNoSecret(error);
      expect(error).toHaveProperty("message", "malformed JSON in the session file");
    },
  );

  it("an unexpected session answer reports its keys and types, never a value such as session.token", async () => {
    const body = JSON.stringify({ session: { token: SECRET, id: "s1" }, user: "x" });
    const { fetch } = fakeFetch(() => body);
    const error = await new SaasClient({ baseUrl: "https://x.test", fetch })
      .getSession()
      .catch((caught) => caught);
    expectNoSecret(error);
    expect(error).toHaveProperty("code", "SESSION_SHAPE");
    expect(error).toHaveProperty("message", expect.stringContaining("session: {token: string, id: string}"));
  });

  it("a non-JSON session answer carrying a secret reports only that it is not JSON", async () => {
    const { fetch } = fakeFetch(() => `<html>${SECRET}</html>`);
    const error = await new SaasClient({ baseUrl: "https://x.test", fetch })
      .getSession()
      .catch((caught) => caught);
    expectNoSecret(error);
    expect(error).toHaveProperty("message", expect.stringContaining("not JSON"));
  });
});
