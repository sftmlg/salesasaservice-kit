export const MCP_ALLOWED_MUTATIONS = [
  "profile.updateInfo",
  "profile.updateAddress",
  "profile.updateUnlimitedPartners",
  "profile.startLogoUpload",
  "profile.completeLogoUpload",
  "profile.cancelLogoUpload",
  "profile.deleteLogo",
  "listings.update",
  "listings.deleteDraft",
  "listingDefaults.save",
  "products.delete",
  "productProposals.delete",
  "offerTemplates.create",
  "activities.create",
  "activities.update",
  "activities.delete",
  "activities.createTask",
  "activities.updateTask",
  "activities.updateTaskStatus",
  "inbox.acknowledge",
  "inbox.acknowledgeFinancial",
  "inbox.acknowledgeProductProposalFailure",
  "companies.create",
  "companies.update",
  "contacts.create",
  "contacts.update",
] as const;

export type McpAllowedMutation = (typeof MCP_ALLOWED_MUTATIONS)[number];

const ALLOWED_NAMES = new Set<string>(MCP_ALLOWED_MUTATIONS);

export function isMcpAllowedMutation(procedure: string): boolean {
  return ALLOWED_NAMES.has(procedure);
}

export function isLegalAct(procedure: string): boolean {
  return !isMcpAllowedMutation(procedure);
}
