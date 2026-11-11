export type ErrorDetails = { code: string; httpStatus?: number; cause?: unknown };

export class SaasError extends Error {
  readonly code: string;
  readonly httpStatus: number | undefined;

  constructor(message: string, details: ErrorDetails) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = new.target.name;
    this.code = details.code;
    this.httpStatus = details.httpStatus;
  }
}

export class NotSignedInError extends SaasError {}
export class OnboardingIncompleteError extends SaasError {}
export class UnknownProcedureError extends SaasError {}
export class MethodNotSupportedError extends SaasError {}
export class ConfirmationRequiredError extends SaasError {}
export class UnexpectedResponseError extends SaasError {}
export class ConfigError extends SaasError {}
