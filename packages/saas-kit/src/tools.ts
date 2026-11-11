import type { SaasClient } from "./client.js";
import type { KitConfig } from "./config.js";
import { type Catalogue, discover } from "./discovery.js";
import { loginWithConfig } from "./kit.js";

export interface ToolDeps {
  client: SaasClient;
  config: KitConfig;
  catalogue: Catalogue;
}

export const tools = {
  async sessionStatus({ client }: ToolDeps) {
    const session = await client.getSession();
    return session
      ? { signedIn: true, user: session.user.email, expires: session.session.expiresAt }
      : { signedIn: false };
  },

  async login({ client, config }: ToolDeps) {
    const session = await loginWithConfig(client, config);
    return { signedIn: true, user: session.user.email, expires: session.session.expiresAt };
  },

  async discover({ client }: ToolDeps, args: { paths?: string[] | undefined }) {
    const result = await discover(client, ["/de", ...(args.paths ?? [])]);
    return {
      procedures: result.procedures,
      routes: result.routes,
      chunks: result.chunks,
      pages: result.pages,
    };
  },

  async listProcedures(
    { catalogue }: ToolDeps,
    args: { router?: string | undefined; kind?: "query" | "mutation" | undefined },
  ) {
    const procedures = Object.entries(catalogue.procedures)
      .filter(
        ([name, entry]) =>
          (!args.router || name.startsWith(`${args.router}.`)) && (!args.kind || entry.kind === args.kind),
      )
      .map(([name, entry]) => ({ name, ...entry }));
    return { measured: catalogue.measured, count: procedures.length, procedures };
  },

  async query({ client }: ToolDeps, args: { procedure: string; input?: unknown }) {
    return client.query(args.procedure, args.input);
  },

  async mutation({ client }: ToolDeps, args: { procedure: string; input?: unknown; confirm: boolean }) {
    return client.mutate(args.procedure, args.input, { confirm: args.confirm });
  },
};
