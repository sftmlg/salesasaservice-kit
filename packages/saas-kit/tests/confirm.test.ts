import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import { assertConfirmed } from "../src/confirm.js";
import { ConfirmationRequiredError } from "../src/errors.js";
import { fakeFetch, ok } from "./helpers.js";

describe("confirm guard", () => {
  it.each([false, undefined, null, "true", 1, "yes", {}])(
    "refuses confirm=%j (a truthy-but-not-true value must not authorise a write)",
    (value) => {
      expect(() => assertConfirmed(value, "mutation x.y")).toThrow(ConfirmationRequiredError);
    },
  );

  it("accepts only the boolean true", () => {
    expect(() => assertConfirmed(true, "mutation x.y")).not.toThrow();
  });

  it("sends no request at all when the mutation is unconfirmed (guard must sit before the network)", async () => {
    const { fetch, calls } = fakeFetch(() => ok(null));
    const client = new SaasClient({ baseUrl: "https://x.test", fetch });
    await expect(client.mutate("listings.publish", { id: 1 }, { confirm: false })).rejects.toBeInstanceOf(
      ConfirmationRequiredError,
    );
    expect(calls).toHaveLength(0);
  });

  it("a confirmed void-input mutation posts the body {} (a {0:null} body is rejected by such procedures)", async () => {
    const { fetch, calls } = fakeFetch(() => ok({ started: true }));
    const client = new SaasClient({ baseUrl: "https://x.test", fetch });
    await client.mutate("verification.startWorkspaceVerification", undefined, { confirm: true });
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toBe("{}");
  });

  it("does not require confirm for queries (reads stay frictionless)", async () => {
    const { fetch, calls } = fakeFetch(() => ok("x"));
    const client = new SaasClient({ baseUrl: "https://x.test", fetch });
    await expect(client.query("subscriptions.getStatus")).resolves.toBe("x");
    expect(calls[0]?.method).toBe("GET");
  });
});
