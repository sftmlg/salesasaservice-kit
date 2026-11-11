import { ConfirmationRequiredError } from "./errors.js";

export function assertConfirmed(confirm: unknown, action: string): void {
  if (confirm !== true) {
    throw new ConfirmationRequiredError(
      `${action} writes on the platform: pass confirm=true only after the account holder approved the exact input`,
      "CONFIRMATION_REQUIRED",
    );
  }
}
