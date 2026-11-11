import type { SaasClient } from "./client.js";
import type { KitConfig } from "./config.js";
import { type Catalogue, discover, probeProcedure } from "./discovery.js";
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
      ? {
          signedIn: true,
          user: session.user.email,
          expires: session.session.expiresAt,
          activeWorkspaceId: session.session.activeWorkspaceId ?? null,
        }
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

  async probe({ client, catalogue }: ToolDeps) {
    const results: { name: string; observed: string }[] = [];
    for (const name of Object.keys(catalogue.procedures).sort()) {
      results.push({ name, observed: await probeProcedure(client, name) });
    }
    const summary: Record<string, number> = {};
    for (const { observed } of results) summary[observed] = (summary[observed] ?? 0) + 1;
    return { count: results.length, summary, results };
  },

  async query({ client }: ToolDeps, args: { procedure: string; input?: unknown }) {
    return client.query(args.procedure, args.input);
  },

  async mutation(
    { client }: ToolDeps,
    args: { procedure: string; input?: unknown; confirm: boolean; legalAct?: boolean },
  ) {
    return client.mutate(args.procedure, args.input, {
      confirm: args.confirm,
      ...(args.legalAct === undefined ? {} : { legalAct: args.legalAct }),
    });
  },
};
