export type TrpcErrorCode =
  | "NOT_FOUND"
  | "PRECONDITION_FAILED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "METHOD_NOT_SUPPORTED"
  | (string & {});

export class SaasError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotSignedInError extends SaasError {}
export class OnboardingIncompleteError extends SaasError {}
export class UnknownProcedureError extends SaasError {}
export class MethodNotSupportedError extends SaasError {}
export class ConfirmationRequiredError extends SaasError {}
export class UnexpectedResponseError extends SaasError {}
export class ConfigError extends SaasError {}
