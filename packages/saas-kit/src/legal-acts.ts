export const LEGAL_ACT_PROCEDURES = [
  "contracts.signWorkspaceContract",
  "opportunities.acceptRequest",
  "opportunities.acceptClose",
  "opportunities.rejectClose",
  "commission.confirmBusinessDetails",
  "commission.requestPayout",
  "commission.updateBankDetails",
  "subscriptions.createCheckout",
  "offers.send",
  "onboarding.createWorkspace",
] as const;

export type LegalActProcedure = (typeof LEGAL_ACT_PROCEDURES)[number];

const LEGAL_ACT_NAMES = new Set<string>(LEGAL_ACT_PROCEDURES.map((name) => name.toLowerCase()));

export function isLegalAct(procedure: string): boolean {
  return LEGAL_ACT_NAMES.has(procedure.toLowerCase());
}
