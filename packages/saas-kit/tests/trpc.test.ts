import { describe, expect, it } from "vitest";
import {
  MethodNotSupportedError,
  NotSignedInError,
  OnboardingIncompleteError,
  SaasError,
  UnexpectedResponseError,
  UnknownProcedureError,
} from "../src/errors.js";
import { errorCodeOf, mutationRequest, queryPath, unwrapEnvelope } from "../src/trpc.js";
import { okReply, trpcError } from "./helpers.js";

describe("request envelope", () => {
  it("wraps query input under batch index 0 (a bare input is silently ignored by the server)", () => {
    const url = new URL(queryPath("listings.list", { page: 2 }), "https://x.test");
    expect(url.searchParams.get("batch")).toBe("1");
    expect(JSON.parse(url.searchParams.get("input") ?? "")).toEqual({ 0: { page: 2 } });
  });

  it("sends null, not undefined, when a query has no input (JSON.stringify drops undefined and the batch key vanishes)", () => {
    const url = new URL(queryPath("subscriptions.getStatus"), "https://x.test");
    expect(url.searchParams.get("input")).toBe('{"0":null}');
  });

  it("percent-encodes the input so braces and quotes survive the URL", () => {
    expect(queryPath("a.b", { q: 'x"y&z' })).not.toMatch(/[{}"]/);
  });

  it("builds mutations as POST bodies keyed by batch index, never in the query string", () => {
    const req = mutationRequest("profile.updateInfo", { name: "A" });
    expect(req.path).toBe("/api/trpc/profile.updateInfo?batch=1");
    expect(JSON.parse(req.body)).toEqual({ 0: { name: "A" } });
  });

  it("sends {} for a mutation without input (a void-input procedure rejects a body that carries a 0 key)", () => {
    expect(mutationRequest("verification.startWorkspaceVerification").body).toBe("{}");
  });

  it("keeps an explicit null input as {0:null} (null is an input, undefined is none)", () => {
    expect(mutationRequest("a.b", null).body).toBe('{"0":null}');
  });

  it.each(["../auth/get-session", "a.b?x=1", "a", "a.b.c", "a.b/../c", ""])(
    "rejects procedure name %j (path traversal into other endpoints)",
    (name) => {
      expect(() => queryPath(name)).toThrow(SaasError);
      expect(() => mutationRequest(name)).toThrow(SaasError);
    },
  );
});

describe("response envelope", () => {
  it("returns result.data from a batch array", () => {
    expect(unwrapEnvelope(200, okReply({ a: 1 }))).toEqual({ a: 1 });
  });

  it("also accepts an unbatched object envelope (otherwise item.error is read from the array and missed)", () => {
    expect(unwrapEnvelope(200, JSON.stringify({ result: { data: 5 } }))).toBe(5);
  });

  it("throws on an error item even when HTTP status is 200 (a batch reports errors per item)", () => {
    expect(() => unwrapEnvelope(200, trpcError("BAD_REQUEST", 400))).toThrow(SaasError);
  });

  it("fails loudly on an HTML body instead of returning undefined (login redirect pages look like success)", () => {
    expect(() => unwrapEnvelope(200, "<html>sign in</html>")).toThrow(UnexpectedResponseError);
  });

  it("fails loudly on an envelope with neither result nor error", () => {
    expect(() => unwrapEnvelope(200, "[{}]")).toThrow(UnexpectedResponseError);
  });

  it("fails loudly on an empty batch", () => {
    expect(() => unwrapEnvelope(200, "[]")).toThrow(UnexpectedResponseError);
  });
});

describe("error mapping", () => {
  const cases: [string, number, new (...args: never[]) => SaasError][] = [
    ["UNAUTHORIZED", 401, NotSignedInError],
    ["PRECONDITION_FAILED", 412, OnboardingIncompleteError],
    ["NOT_FOUND", 404, UnknownProcedureError],
    ["METHOD_NOT_SUPPORTED", 405, MethodNotSupportedError],
  ];
  it.each(cases)(
    "maps %s to its own class so callers can tell onboarding from a missing procedure",
    (code, status, cls) => {
      let caught: unknown;
      try {
        unwrapEnvelope(status, trpcError(code, status));
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(cls);
      expect((caught as SaasError).code).toBe(code);
      expect((caught as SaasError).httpStatus).toBe(status);
    },
  );

  it("keeps unknown codes as a plain SaasError with the server code (no silent downgrade to success)", () => {
    expect(() => unwrapEnvelope(500, trpcError("INTERNAL_SERVER_ERROR", 500))).toThrow(
      /INTERNAL_SERVER_ERROR/,
    );
  });

  it("probe classification distinguishes OK, tRPC code and bare HTTP failure (a 502 page must not read as NOT_FOUND)", () => {
    expect(errorCodeOf(200, okReply(1))).toBe("OK");
    expect(errorCodeOf(412, trpcError("PRECONDITION_FAILED", 412))).toBe("PRECONDITION_FAILED");
    expect(errorCodeOf(502, "<html>bad gateway</html>")).toBe("HTTP_502");
  });
});
