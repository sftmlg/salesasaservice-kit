import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import { NotSignedInError, SaasError } from "../src/errors.js";
import { fakeFetch } from "./helpers.js";

describe("auth flow", () => {
  it("fails with NotSignedIn when sign-in succeeds but no session appears (unverified email returns 200 without a cookie)", async () => {
    const { fetch } = fakeFetch((req) => (req.url.endsWith("/get-session") ? "null" : "{}"));
    const client = new SaasClient({ baseUrl: "https://x.test", fetch });
    await expect(client.signIn({ email: "a", password: "b" })).rejects.toBeInstanceOf(NotSignedInError);
  });

  it("surfaces a refused sign-in with its status instead of continuing to get-session", async () => {
    const { fetch, calls } = fakeFetch(() => ({ status: 403, body: '{"code":"EMAIL_NOT_VERIFIED"}' }));
    const client = new SaasClient({ baseUrl: "https://x.test", fetch });
    await expect(client.signIn({ email: "a", password: "b" })).rejects.toMatchObject({
      code: "SIGN_IN_FAILED",
      httpStatus: 403,
    });
    expect(calls).toHaveLength(1);
  });

  it("getSession returns null for a signed-out answer", async () => {
    const { fetch } = fakeFetch(() => "null");
    expect(await new SaasClient({ baseUrl: "https://x.test", fetch }).getSession()).toBeNull();
  });

  it("getSession throws on an HTTP error rather than reporting signed out (outage must not look like logout)", async () => {
    const { fetch } = fakeFetch(() => ({ status: 503, body: "down" }));
    await expect(new SaasClient({ baseUrl: "https://x.test", fetch }).getSession()).rejects.toBeInstanceOf(
      SaasError,
    );
  });

  it.each(["<html>login</html>", "[]", '{"user":"x"}'])(
    "getSession throws on the unknown body %j instead of reporting signed out (a login page must not look like logout)",
    async (body) => {
      const { fetch } = fakeFetch(() => body);
      await expect(new SaasClient({ baseUrl: "https://x.test", fetch }).getSession()).rejects.toMatchObject({
        code: "SESSION_SHAPE",
      });
    },
  );

  it("getSession returns the user and the expiry of a signed-in answer", async () => {
    const { fetch } = fakeFetch(() => '{"user":{"email":"a@b.c"},"session":{"expiresAt":"2026-12-01"}}');
    expect(await new SaasClient({ baseUrl: "https://x.test", fetch }).getSession()).toEqual({
      user: { email: "a@b.c" },
      session: { expiresAt: "2026-12-01" },
    });
  });

  it("sign-up sends acceptTerms and no cookie", async () => {
    const { fetch, calls } = fakeFetch(() => "{}");
    await new SaasClient({ baseUrl: "https://x.test", fetch }).signUp({
      name: "N N",
      email: "a@b.c",
      password: "p",
      acceptTerms: true,
    });
    expect(JSON.parse(calls[0]?.body ?? "{}")).toMatchObject({ acceptTerms: true, email: "a@b.c" });
    expect(calls[0]?.headers.cookie).toBeUndefined();
  });

  it("refuses a verification link on a foreign origin (the session cookie must not be sent to a third party)", async () => {
    const { fetch, calls } = fakeFetch(() => "");
    const client = new SaasClient({ baseUrl: "https://x.test", fetch });
    await expect(client.verifyEmail("https://evil.test/api/auth/verify-email?token=t")).rejects.toMatchObject(
      { code: "FOREIGN_LINK" },
    );
    expect(calls).toHaveLength(0);
  });

  it.each(["@evil.test/x", ".evil.test", "evil", ""])(
    "refuses the path %j (base URL plus a path without a leading slash can change the host and carry the session cookie there)",
    async (path) => {
      const { fetch, calls } = fakeFetch(() => "");
      const client = new SaasClient({ baseUrl: "https://x.test", fetch });
      await expect(client.http(path)).rejects.toMatchObject({ code: "BAD_PATH" });
      expect(calls).toHaveLength(0);
    },
  );

  it("follows a same-origin verification link by path and query", async () => {
    const { fetch, calls } = fakeFetch(() => ({ status: 302, location: "/de" }));
    await new SaasClient({ baseUrl: "https://x.test", fetch }).verifyEmail(
      "https://x.test/api/auth/verify-email?token=t&callbackURL=%2Fde",
    );
    expect(calls[0]?.url).toBe("https://x.test/api/auth/verify-email?token=t&callbackURL=%2Fde");
  });
});
