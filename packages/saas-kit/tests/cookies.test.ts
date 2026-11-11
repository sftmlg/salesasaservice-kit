import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import { applySetCookies, cookieHeader } from "../src/cookies.js";
import { ConfigError } from "../src/errors.js";
import { FileSessionStore } from "../src/session-store.js";
import { fakeFetch, ok } from "./helpers.js";

describe("cookie jar", () => {
  it("keeps '=' inside the value (signed session tokens end in %3D or contain '=')", () => {
    const jar = applySetCookies({}, ["tok=abc.def=ghi==; Path=/; HttpOnly"]);
    expect(jar.tok).toBe("abc.def=ghi==");
  });

  it("drops a cookie cleared with Max-Age=0 (sign-out must not keep sending the old session)", () => {
    expect(applySetCookies({ s: "1", k: "2" }, ["s=; Max-Age=0; Path=/"])).toEqual({ k: "2" });
  });

  it("drops a cookie with an empty value", () => {
    expect(applySetCookies({ s: "1" }, ["s=; Path=/"])).toEqual({});
  });

  it("drops a cookie whose Expires is in the past", () => {
    const now = Date.parse("2026-11-11T00:00:00Z");
    expect(applySetCookies({ s: "1" }, ["s=x; Expires=Thu, 01 Jan 1970 00:00:00 GMT"], now)).toEqual({});
  });

  it("keeps a cookie whose Expires is in the future", () => {
    const now = Date.parse("2026-11-11T00:00:00Z");
    expect(applySetCookies({}, ["s=x; Expires=Fri, 01 Jan 2100 00:00:00 GMT"], now)).toEqual({ s: "x" });
  });

  it("replaces a rotated value instead of appending a duplicate", () => {
    expect(applySetCookies({ s: "old" }, ["s=new; Path=/"])).toEqual({ s: "new" });
  });

  it("does not mutate the previous jar (stores compare old and new state)", () => {
    const before = { s: "1" };
    applySetCookies(before, ["s=2"]);
    expect(before).toEqual({ s: "1" });
  });

  it("ignores a malformed line without a name", () => {
    expect(applySetCookies({}, ["=novalue", "garbage"])).toEqual({});
  });

  it("joins cookies into one Cookie header", () => {
    expect(cookieHeader({ a: "1", b: "2" })).toBe("a=1; b=2");
  });
});

describe("cookies through the client", () => {
  it("stores the session cookie from sign-in and sends it with the next call (login that is not reused is useless)", async () => {
    const { fetch, calls } = fakeFetch((req) => {
      if (req.url.endsWith("/sign-in/email"))
        return { body: "{}", setCookie: ["__Secure-better-auth.session_token=tok; Path=/"] };
      if (req.url.endsWith("/get-session")) return JSON.stringify({ user: { email: "a@b.c" }, session: {} });
      return ok(1);
    });
    const client = new SaasClient({ baseUrl: "https://x.test", fetch });
    await client.signIn({ email: "a@b.c", password: "pw" });
    await client.query("subscriptions.getStatus");
    expect(calls.at(-1)?.headers.cookie).toBe("__Secure-better-auth.session_token=tok");
  });

  it("sends no cookie on sign-in itself (a stale session would be echoed back into the credentials call)", async () => {
    const { fetch, calls } = fakeFetch((req) =>
      req.url.endsWith("/get-session") ? JSON.stringify({ user: {} }) : "{}",
    );
    const client = new SaasClient({ baseUrl: "https://x.test", fetch });
    await client.signIn({ email: "a", password: "b" });
    expect(calls[0]?.headers.cookie).toBeUndefined();
  });

  it("sends an Origin matching the site on POST (the platform's CSRF check refuses without it)", async () => {
    const { fetch, calls } = fakeFetch(() => ok(null));
    const client = new SaasClient({ baseUrl: "https://x.test/", fetch });
    await client.mutate("a.b", {}, { confirm: true });
    expect(calls[0]?.headers.origin).toBe("https://x.test");
    expect(calls[0]?.url).toBe("https://x.test/api/trpc/a.b?batch=1");
  });
});

describe("file session store", () => {
  it("writes the session file with owner-only permissions (cookie is a bearer credential)", () => {
    const file = join(mkdtempSync(join(tmpdir(), "saas-")), "nested", "session.json");
    const store = new FileSessionStore(file);
    store.save({ s: "1" });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(store.load()).toEqual({ s: "1" });
  });

  it.each(["{not json", '{"cookies":{"s":1}}', '{"cookies":[]}'])(
    "reports the unreadable session file %j as a config error instead of a raw parse error or a jar of wrong types",
    (content) => {
      const file = join(mkdtempSync(join(tmpdir(), "saas-")), "session.json");
      writeFileSync(file, content);
      expect(() => new FileSessionStore(file).load()).toThrow(ConfigError);
    },
  );

  it("loads an empty jar when the file does not exist yet (first run must not throw)", () => {
    expect(new FileSessionStore(join(mkdtempSync(join(tmpdir(), "saas-")), "none.json")).load()).toEqual({});
  });
});
