import type { SaasClient } from "./client.js";
import { errorCodeOf, queryPath } from "./trpc.js";

export type ProcedureKind = "query" | "mutation";

export interface ProcedureEntry {
  kind: ProcedureKind;
  observed: string;
}

export interface Catalogue {
  measured: string;
  procedures: Record<string, ProcedureEntry>;
}

const PROC_RE =
  /\b([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)\.(queryOptions|mutationOptions|infiniteQueryOptions|useQuery|useMutation|useSuspenseQuery|useInfiniteQuery|queryKey|pathFilter)\b/g;
const ROUTE_RE = /["'`](\/(?:de|en)\/[a-z0-9\-/[\]]*)["'`]/g;
const CHUNK_RE = /\/_next\/static\/[^"'\\\s)]+\.js/g;

export function extractProcedures(source: string): Record<string, ProcedureKind> {
  const found: Record<string, ProcedureKind> = {};
  for (const m of source.matchAll(PROC_RE)) {
    const kind: ProcedureKind = /mutation/i.test(m[3] ?? "") ? "mutation" : "query";
    const key = `${m[1]}.${m[2]}`;
    if (!found[key]) found[key] = kind;
  }
  return found;
}

export function extractRoutes(source: string): string[] {
  return [...source.matchAll(ROUTE_RE)].map((m) => (m[1] ?? "").replace(/\/$/, "") || (m[1] ?? ""));
}

export function extractChunks(html: string): string[] {
  return [...new Set(html.match(CHUNK_RE) ?? [])];
}

export interface DiscoveryResult {
  procedures: Record<string, ProcedureKind>;
  routes: string[];
  chunks: number;
  pages: Record<string, string>;
}

export async function discover(
  client: SaasClient,
  startPaths: readonly string[] = ["/de"],
  rounds = 3,
): Promise<DiscoveryResult> {
  const procedures: Record<string, ProcedureKind> = {};
  const routes = new Set<string>(startPaths);
  const seenPages = new Set<string>();
  const seenChunks = new Set<string>();
  const pages: Record<string, string> = {};
  for (let round = 0; round < rounds; round++) {
    const todo = [...routes].filter((p) => !seenPages.has(p) && !p.includes("["));
    if (todo.length === 0) break;
    for (const path of todo) {
      seenPages.add(path);
      const page = await client.http(path, { accept: "text/html" });
      pages[path] = page.location ? `${page.status} -> ${page.location}` : String(page.status);
      if (page.status !== 200) continue;
      mergeSource(page.text, procedures, routes);
      for (const chunk of extractChunks(page.text)) {
        if (seenChunks.has(chunk)) continue;
        seenChunks.add(chunk);
        const js = await client.http(chunk, { accept: "*/*" });
        if (js.status === 200) mergeSource(js.text, procedures, routes);
      }
    }
  }
  return { procedures, routes: [...routes].sort(), chunks: seenChunks.size, pages };
}

function mergeSource(source: string, procedures: Record<string, ProcedureKind>, routes: Set<string>): void {
  for (const [name, kind] of Object.entries(extractProcedures(source))) procedures[name] ??= kind;
  for (const route of extractRoutes(source)) routes.add(route);
}

export async function probeProcedure(client: SaasClient, procedure: string): Promise<string> {
  const res = await client.http(queryPath(procedure));
  return errorCodeOf(res.status, res.text);
}

export async function buildCatalogue(
  client: SaasClient,
  discovered: Record<string, ProcedureKind>,
  today = new Date(),
): Promise<{ catalogue: Catalogue; notFound: string[] }> {
  const procedures: Record<string, ProcedureEntry> = {};
  const notFound: string[] = [];
  for (const [name, kind] of Object.entries(discovered).sort(([a], [b]) => a.localeCompare(b))) {
    const observed = await probeProcedure(client, name);
    if (observed === "NOT_FOUND") notFound.push(name);
    else procedures[name] = { kind, observed };
  }
  return { catalogue: { measured: today.toISOString().slice(0, 10), procedures }, notFound };
}
