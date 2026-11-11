import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { runApply } from "./apply.js";
import { ConfigError } from "./errors.js";
import { fetchProductsPage } from "./products-page.js";
import { type ToolDeps, tools } from "./tools.js";

type LiveCommand = (deps: ToolDeps, args: string[]) => Promise<unknown>;

function parseInput(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new ConfigError(`input is not valid JSON: ${raw.slice(0, 80)}`, { code: "CONFIG", cause });
  }
}

function procedureAndInput(args: string[]): {
  procedure: string;
  input: unknown;
  confirm: boolean;
  legalAct: boolean;
} {
  const { values, positionals } = parseArgs({
    args,
    options: { confirm: { type: "boolean" }, "legal-act": { type: "boolean" } },
    allowPositionals: true,
  });
  const [procedure, raw] = positionals;
  if (!procedure)
    throw new ConfigError("a procedure name (router.procedure) is required", { code: "CONFIG" });
  return {
    procedure,
    input: parseInput(raw),
    confirm: values.confirm === true,
    legalAct: values["legal-act"] === true,
  };
}

function applyFile(deps: ToolDeps, args: string[]): Promise<unknown> {
  const { values, positionals } = parseArgs({
    args,
    options: { confirm: { type: "boolean" }, "legal-act": { type: "boolean" }, publish: { type: "boolean" } },
    allowPositionals: true,
  });
  const [file] = positionals;
  if (!file) throw new ConfigError("apply needs the path of a JSON file", { code: "CONFIG" });
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (cause) {
    throw new ConfigError("cannot read the apply file", { code: "CONFIG", cause });
  }
  return runApply(deps.client, text, {
    confirm: values.confirm === true,
    legalAct: values["legal-act"] === true,
    publish: values.publish === true,
  });
}

const liveCommands: Record<string, LiveCommand> = {
  status: (deps) => tools.sessionStatus(deps),
  login: (deps) => tools.login(deps),
  discover: (deps, args) =>
    tools.discover(deps, {
      paths: parseArgs({ args, options: { path: { type: "string", multiple: true } } }).values.path,
    }),
  list: (deps, args) => {
    const { values } = parseArgs({ args, options: { router: { type: "string" }, kind: { type: "string" } } });
    if (values.kind !== undefined && values.kind !== "query" && values.kind !== "mutation") {
      throw new ConfigError("--kind must be query or mutation", { code: "CONFIG" });
    }
    return tools.listProcedures(deps, { router: values.router, kind: values.kind });
  },
  probe: (deps) => tools.probe(deps),
  catalogue: (deps) => fetchProductsPage(deps.client),
  apply: applyFile,
  query: (deps, args) => {
    const { procedure, input } = procedureAndInput(args);
    return tools.query(deps, { procedure, input });
  },
  mutation: (deps, args) => {
    return tools.mutation(deps, procedureAndInput(args));
  },
};

export function isLiveCommand(name: string): boolean {
  return Object.hasOwn(liveCommands, name);
}

export async function runLiveCommand(name: string, deps: ToolDeps, args: string[]): Promise<unknown> {
  const command = Object.hasOwn(liveCommands, name) ? liveCommands[name] : undefined;
  if (!command) throw new ConfigError(`unknown command ${name}`, { code: "CONFIG" });
  return command(deps, args);
}
