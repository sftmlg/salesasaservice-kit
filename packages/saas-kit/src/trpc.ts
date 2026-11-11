import {
  MethodNotSupportedError,
  NotSignedInError,
  OnboardingIncompleteError,
  SaasError,
  UnexpectedResponseError,
  UnknownProcedureError,
} from "./errors.js";

const PROCEDURE_RE = /^[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*$/;

export function assertProcedureName(name: string): void {
  if (!PROCEDURE_RE.test(name)) {
    throw new SaasError(`invalid procedure name "${name}", expected router.procedure`, "BAD_PROCEDURE_NAME");
  }
}

export function queryPath(procedure: string, input?: unknown): string {
  assertProcedureName(procedure);
  const params = new URLSearchParams({ batch: "1", input: JSON.stringify({ 0: input ?? null }) });
  return `/api/trpc/${procedure}?${params}`;
}

export function mutationRequest(procedure: string, input?: unknown): { path: string; body: string } {
  assertProcedureName(procedure);
  return {
    path: `/api/trpc/${procedure}?batch=1`,
    body: JSON.stringify(input === undefined ? {} : { 0: input }),
  };
}

interface ErrorItem {
  error?: { message?: string; data?: { code?: string; httpStatus?: number } };
  result?: { data?: unknown };
}

export function unwrapEnvelope(status: number, text: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UnexpectedResponseError(
      `non-JSON answer (HTTP ${status}): ${text.slice(0, 200)}`,
      "NON_JSON",
      status,
    );
  }
  const item = (Array.isArray(parsed) ? parsed[0] : parsed) as ErrorItem | undefined;
  if (!item || typeof item !== "object") {
    throw new UnexpectedResponseError(`empty tRPC envelope (HTTP ${status})`, "EMPTY_ENVELOPE", status);
  }
  if (item.error) throw mapTrpcError(item.error, status);
  if (!item.result) {
    throw new UnexpectedResponseError(
      `envelope without result or error (HTTP ${status})`,
      "NO_RESULT",
      status,
    );
  }
  return item.result.data;
}

export function mapTrpcError(error: NonNullable<ErrorItem["error"]>, status: number): SaasError {
  const code = error.data?.code ?? "UNKNOWN";
  const httpStatus = error.data?.httpStatus ?? status;
  const message = error.message ?? code;
  switch (code) {
    case "UNAUTHORIZED":
      return new NotSignedInError(message, code, httpStatus);
    case "PRECONDITION_FAILED":
      return new OnboardingIncompleteError(message, code, httpStatus);
    case "NOT_FOUND":
      return new UnknownProcedureError(message, code, httpStatus);
    case "METHOD_NOT_SUPPORTED":
      return new MethodNotSupportedError(message, code, httpStatus);
    default:
      return new SaasError(message, code, httpStatus);
  }
}

export function errorCodeOf(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as ErrorItem | ErrorItem[];
    const item = Array.isArray(parsed) ? parsed[0] : parsed;
    if (item?.error) return item.error.data?.code ?? "UNKNOWN";
    if (item?.result) return "OK";
  } catch {
    return `HTTP_${status}`;
  }
  return `HTTP_${status}`;
}
