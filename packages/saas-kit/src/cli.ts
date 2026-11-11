#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { CATALOGUE_FILE, loadCatalogue } from "./catalogue-data.js";
import { renderCatalogue } from "./catalogue-doc.js";
import { isLiveCommand, runLiveCommand } from "./cli-live.js";
import { DEFAULT_BASE_URL, loadConfig } from "./config.js";
import { buildCatalogue, discover, UNDISCOVERABLE } from "./discovery.js";
import { SaasError } from "./errors.js";
import { createClient, ensureSession } from "./kit.js";
import { buildOpenApi } from "./openapi.js";
import { printErrorLine, printLine } from "./output.js";

const USAGE = `saas-kit <command>

  docs <openapi.json> <catalogue.md>   render the OpenAPI file and the catalogue page from the bundled catalogue
  refresh [--path /de/x]... [--procedure router.name]...
                                       discover procedures with a live session, probe them read-only, rewrite the bundled catalogue;
                                       --procedure adds a name the crawl cannot reach (a GET probe still has to confirm it)

  status | login | discover [--path /de/x]... | list [--router r] [--kind query|mutation] | probe
  query <router.name> [json]           GET; probe prints the answer code of a read-only GET for every catalogued procedure
  mutation <router.name> [json] --confirm
                                       POST; refused without --confirm, a void-input procedure takes no json

Environment: SAAS_BASE_URL, SAAS_SESSION_FILE, SAAS_CREDENTIALS_FILE or SAAS_EMAIL and SAAS_PASSWORD`;

function write(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "docs") {
    const [openapiFile, catalogueFile] = args;
    if (!openapiFile || !catalogueFile) return usage();
    const catalogue = loadCatalogue();
    write(openapiFile, `${JSON.stringify(buildOpenApi(catalogue, DEFAULT_BASE_URL), null, 2)}\n`);
    write(catalogueFile, renderCatalogue(catalogue));
    return 0;
  }
  if (command === "refresh") {
    const { values } = parseArgs({
      args,
      options: { path: { type: "string", multiple: true }, procedure: { type: "string", multiple: true } },
    });
    const config = loadConfig();
    const client = createClient(config);
    await ensureSession(client, config);
    const found = await discover(client, ["/de", ...(values.path ?? [])]);
    const { catalogue, notFound } = await buildCatalogue(client, found.procedures, new Date(), [
      ...Object.keys(UNDISCOVERABLE),
      ...(values.procedure ?? []),
    ]);
    write(fileURLToPath(CATALOGUE_FILE), `${JSON.stringify(catalogue, null, 2)}\n`);
    printLine(JSON.stringify({ confirmed: Object.keys(catalogue.procedures).length, notFound }, null, 2));
    return 0;
  }
  if (command && isLiveCommand(command)) {
    const config = loadConfig();
    const deps = { client: createClient(config), config, catalogue: loadCatalogue() };
    const value = await runLiveCommand(command, deps, args);
    printLine(JSON.stringify(value ?? null, null, 2));
    return 0;
  }
  return usage();
}

function usage(): number {
  printErrorLine(USAGE);
  return 3;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    const code = error instanceof SaasError ? `${error.code}: ` : "";
    printErrorLine(`${code}${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
