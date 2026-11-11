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
      `${procedure} is not on the allowlist of reviewed working mutations: record edits and read marks, where created records stay in the account and read marks have no undo (an unknown name is refused too), ` +
        "so it may publish, accept, reject, sign, send, pay, subscribe, consent, remove users or submit in the account holder's name. " +
        "confirm=true is set by an agent, so platform text could steer an agent into it. " +
        "It is not available through the MCP server; the account holder runs it with the CLI flags --confirm --legal-act, or in the platform itself",
      { code: "LEGAL_ACT_REFUSED" },
    );
  }
}

export function assertSignUpAllowed(legalAct: unknown): void {
  if (legalAct !== true) {
    throw new LegalActRefusedError(
      "sign-up accepts the platform terms in a person's name: pass legalAct=true only after that person decided to accept them",
      { code: "LEGAL_ACT_REFUSED" },
    );
  }
}
