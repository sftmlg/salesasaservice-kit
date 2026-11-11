import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import { ensureSession } from "../src/kit.js";
import { fakeFetch } from "./helpers.js";

const session = '{"user":{"email":"a@b.c"},"session":{}}';
const config = {
  baseUrl: "https://x.test",
  sessionFile: undefined,
  credentials: { email: "a", password: "b" },
};

describe("ensureSession", () => {
  it("reuses a valid stored session and sends no sign-in (every login attempt counts against the account)", async () => {
    const { fetch, calls } = fakeFetch(() => session);
    await ensureSession(new SaasClient({ baseUrl: "https://x.test", fetch }), config);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(["/api/auth/get-session"]);
  });

  it("signs in once when no session exists", async () => {
    let signedIn = false;
    const { fetch, calls } = fakeFetch((req) => {
      if (req.url.endsWith("/sign-in/email")) signedIn = true;
      return req.url.endsWith("/get-session") && !signedIn ? "null" : session;
    });
    await ensureSession(new SaasClient({ baseUrl: "https://x.test", fetch }), config);
    expect(calls.filter((call) => call.url.endsWith("/sign-in/email"))).toHaveLength(1);
  });
});
