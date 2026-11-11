import type { SaasClient } from "./client.js";
import { SaasError } from "./errors.js";
import { errorCodeOf, queryPath } from "./trpc.js";

export type ProcedureKind = "query" | "mutation";

export type Confirmation = "get-refused" | "get-answered" | "unprobed";

export interface ProcedureEntry {
  router: string;
  kind: ProcedureKind;
  confirmedBy: Confirmation;
  note?: string | undefined;
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
const APP_PAGE_RE = /^\/(?:de|en)(?:\/[A-Za-z0-9_[\]-]+)*\/?$/;

export const DEFAULT_CRAWL_PATHS: readonly string[] = ["/de", "/de/business-partner/products-services"];

export function crawlStartPaths(extra: readonly string[] = []): string[] {
  return [...new Set([...DEFAULT_CRAWL_PATHS, ...extra])];
}

export function isAppPage(path: string): boolean {
  return APP_PAGE_RE.test(path);
}

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

const STATIC_PREFIX = "/_next/static/";
const MAX_DECODE_ROUNDS = 5;

function fullyDecoded(path: string): string | undefined {
  let current = path;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return undefined;
    }
    if (next === current) return current;
    current = next;
  }
  return undefined;
}

function climbs(path: string): boolean {
  return path.split(/[/\\]/).some((segment) => segment === "." || segment === "..");
}

export function isStaticChunkPath(chunk: string): boolean {
  const decoded = fullyDecoded(chunk);
  if (decoded === undefined || climbs(decoded) || climbs(chunk)) return false;
  const resolved = new URL(chunk, "http://chunk.invalid");
  return resolved.origin === "http://chunk.invalid" && resolved.pathname.startsWith(STATIC_PREFIX);
}

export function extractChunks(html: string): string[] {
  return [...new Set(html.match(CHUNK_RE) ?? [])].filter(isStaticChunkPath);
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
  const refused = startPaths.filter((path) => !isAppPage(path));
  if (refused.length > 0) {
    throw new SaasError(`discover crawls app pages under /de or /en only, refused: ${refused.join(", ")}`, {
      code: "NOT_AN_APP_PAGE",
    });
  }
  const state: CrawlState = {
    procedures: {},
    routes: new Set<string>(startPaths),
    seenChunks: new Set<string>(),
    pages: {},
  };
  const seenPages = new Set<string>();
  for (let round = 0; round < rounds; round++) {
    const todo = [...state.routes].filter(
      (route) => isAppPage(route) && !seenPages.has(route) && !route.includes("["),
    );
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

const METHOD_REFUSED = "METHOD_NOT_SUPPORTED";

function isProcedureAnswer(observed: string): boolean {
  return observed !== "UNAUTHORIZED" && !observed.startsWith("HTTP_");
}

export const UNDISCOVERABLE: Record<string, string> = {
  "onboarding.createWorkspace":
    "Discovery cannot see it before a page loads the chunk that calls it (the onboarding screen of an account without a workspace). It is added by name and confirmed by the GET probe.",
};

export function kindFromProbe(observed: string, discovered?: ProcedureKind): ProcedureKind {
  if (observed === METHOD_REFUSED) return "mutation";
  return discovered ?? "query";
}

export async function buildCatalogue(
  client: SaasClient,
  discovered: Record<string, ProcedureKind>,
  today = new Date(),
  supplied: readonly string[] = [],
): Promise<{ catalogue: Catalogue; notFound: string[] }> {
  const procedures: Record<string, ProcedureEntry> = {};
  const notFound: string[] = [];
  const unprobed: string[] = [];
  const names = [...new Set([...Object.keys(discovered), ...supplied])].sort((left, right) =>
    left.localeCompare(right),
  );
  if (names.length === 0) {
    throw new SaasError("no procedure names to probe: the crawl found none (signed out?)", {
      code: "NOTHING_TO_PROBE",
    });
  }
  for (const name of names) {
    const observed = await probeProcedure(client, name);
    if (observed === "NOT_FOUND") notFound.push(name);
    else if (isProcedureAnswer(observed)) {
      const note = UNDISCOVERABLE[name];
      procedures[name] = {
        router: name.split(".")[0] ?? "",
        kind: kindFromProbe(observed, discovered[name]),
        confirmedBy: observed === METHOD_REFUSED ? "get-refused" : "get-answered",
        ...(note ? { note } : {}),
      };
    } else unprobed.push(`${name} (${observed})`);
  }
  if (unprobed.length > 0) {
    throw new SaasError(
      `${unprobed.length} probes got no procedure answer, so no catalogue is built: ${unprobed.join(", ")}`,
      { code: "PROBE_FAILED" },
    );
  }
  return { catalogue: { measured: today.toISOString().slice(0, 10), procedures }, notFound };
}
