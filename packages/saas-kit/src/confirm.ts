import { ConfirmationRequiredError, LegalActRefusedError } from "./errors.js";
import { isLegalAct } from "./legal-acts.js";

export function assertConfirmed(confirm: unknown, action: string): void {
  if (confirm !== true) {
    throw new ConfirmationRequiredError(
      `${action} writes on the platform: pass confirm=true only after the account holder approved the exact input`,
      { code: "CONFIRMATION_REQUIRED" },
    );
  }
}

export function assertLegalActAllowed(procedure: string, legalAct: unknown): void {
  if (isLegalAct(procedure) && legalAct !== true) {
    throw new LegalActRefusedError(
      `${procedure} is a legal act in the account holder's name (signing, accepting, paying out, changing bank details, checkout, sending an offer, creating the workspace). ` +
        "confirm=true is set by an agent, so platform text could steer an agent into it. " +
        "It is not available through the MCP server; the account holder runs it with the CLI flags --confirm --legal-act, or in the platform itself",
      { code: "LEGAL_ACT_REFUSED" },
    );
  }
}
