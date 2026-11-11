import { ConfigError } from "./errors.js";

function tryParse(text: string): { value: unknown } | undefined {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return undefined;
  }
}

export function parseSecretJson(text: string, fileKind: string, code: string): unknown {
  const parsed = tryParse(text);
  if (!parsed) throw new ConfigError(`malformed JSON in ${fileKind}`, { code });
  return parsed.value;
}
