export const MCP_ALLOWED_MUTATIONS = [
  "profile.startLogoUpload",
  "profile.completeLogoUpload",
  "profile.cancelLogoUpload",
  "offerTemplates.create",
  "activities.create",
  "activities.update",
  "activities.createTask",
  "activities.updateTask",
  "activities.updateTaskStatus",
  "inbox.acknowledge",
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
