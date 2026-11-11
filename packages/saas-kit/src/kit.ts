import { type FetchLike, SaasClient } from "./client.js";
import type { KitConfig } from "./config.js";
import { NotSignedInError } from "./errors.js";
import { FileSessionStore, MemorySessionStore } from "./session-store.js";

export function createClient(config: KitConfig, fetchImpl?: FetchLike): SaasClient {
  const store = config.sessionFile ? new FileSessionStore(config.sessionFile) : new MemorySessionStore();
  return new SaasClient({ baseUrl: config.baseUrl, store, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
}

export async function loginWithConfig(client: SaasClient, config: KitConfig) {
  if (!config.credentials) {
    throw new NotSignedInError(
      "no credentials: set SAAS_CREDENTIALS_FILE (JSON with email and password) or SAAS_EMAIL and SAAS_PASSWORD",
      "NO_CREDENTIALS",
    );
  }
  return client.signIn(config.credentials);
}
