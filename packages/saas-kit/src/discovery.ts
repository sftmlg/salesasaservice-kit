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
const APP_ROUTE_RE = /(?:href|pathname|push|replace)[:(]\s*["'`](\/[a-z][a-z0-9\-/[\]]*)["'`]/g;
const CHUNK_RE = /\/_next\/static\/[^"'\\\s)]+\.js/g;

export function extractProcedures(source: string): Record<string, ProcedureKind> {
  const found: Record<string, ProcedureKind> = {};
  for (const match of source.matchAll(PROC_RE)) {
    const kind: ProcedureKind = /mutation/i.test(match[3] ?? "") ? "mutation" : "query";
    const key = `${match[1]}.${match[2]}`;
    if (!found[key]) found[key] = kind;
  }
  return found;
}

export function extractRoutes(source: string): string[] {
  const localized = [...source.matchAll(ROUTE_RE)].map(
    (match) => (match[1] ?? "").replace(/\/$/, "") || (match[1] ?? ""),
  );
  const unprefixed = [...source.matchAll(APP_ROUTE_RE)]
    .map((match) => match[1] ?? "")
    .filter((route) => !/^\/(api|_next|de|en)(\/|$)/.test(route))
    .map((route) => `/de${route.replace(/\/$/, "")}`);
  return [...localized, ...unprefixed];
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

interface CrawlState {
  procedures: Record<string, ProcedureKind>;
  routes: Set<string>;
  seenChunks: Set<string>;
  pages: Record<string, string>;
}

async function crawlPage(client: SaasClient, path: string, state: CrawlState): Promise<void> {
  const page = await client.http(path, { accept: "text/html" });
  state.pages[path] = page.location ? `${page.status} -> ${page.location}` : String(page.status);
  if (page.status !== 200) return;
  mergeSource(page.text, state.procedures, state.routes);
  for (const chunk of extractChunks(page.text)) {
    if (state.seenChunks.has(chunk)) continue;
    state.seenChunks.add(chunk);
    const script = await client.http(chunk, { accept: "*/*" });
    if (script.status === 200) mergeSource(script.text, state.procedures, state.routes);
  }
}

export async function discover(
  client: SaasClient,
  startPaths: readonly string[] = ["/de"],
  rounds = 3,
): Promise<DiscoveryResult> {
  const state: CrawlState = {
    procedures: {},
    routes: new Set<string>(startPaths),
    seenChunks: new Set<string>(),
    pages: {},
  };
  const seenPages = new Set<string>();
  for (let round = 0; round < rounds; round++) {
    const todo = [...state.routes].filter((route) => !seenPages.has(route) && !route.includes("["));
    if (todo.length === 0) break;
    for (const path of todo) {
      seenPages.add(path);
      await crawlPage(client, path, state);
    }
  }
  return {
    procedures: state.procedures,
    routes: [...state.routes].sort(),
    chunks: state.seenChunks.size,
    pages: state.pages,
  };
}

function mergeSource(source: string, procedures: Record<string, ProcedureKind>, routes: Set<string>): void {
  for (const [name, kind] of Object.entries(extractProcedures(source))) procedures[name] ??= kind;
  for (const route of extractRoutes(source)) routes.add(route);
}

export async function probeProcedure(client: SaasClient, procedure: string): Promise<string> {
  const res = await client.http(queryPath(procedure));
  return errorCodeOf(res.status, res.text);
}

export function kindFromProbe(observed: string): ProcedureKind {
  return observed === "METHOD_NOT_SUPPORTED" ? "mutation" : "query";
}

export async function buildCatalogue(
  client: SaasClient,
  discovered: Record<string, ProcedureKind>,
  today = new Date(),
  supplied: readonly string[] = [],
): Promise<{ catalogue: Catalogue; notFound: string[] }> {
  const procedures: Record<string, ProcedureEntry> = {};
  const notFound: string[] = [];
  const names = [...new Set([...Object.keys(discovered), ...supplied])].sort((left, right) =>
    left.localeCompare(right),
  );
  for (const name of names) {
    const observed = await probeProcedure(client, name);
    if (observed === "NOT_FOUND") notFound.push(name);
    else procedures[name] = { kind: discovered[name] ?? kindFromProbe(observed), observed };
  }
  return { catalogue: { measured: today.toISOString().slice(0, 10), procedures }, notFound };
}
