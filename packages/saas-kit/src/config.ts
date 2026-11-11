import { readFileSync } from "node:fs";
import { ConfigError } from "./errors.js";

export interface Credentials {
  email: string;
  password: string;
}

export interface KitConfig {
  baseUrl: string;
  sessionFile: string | undefined;
  credentials: Credentials | undefined;
}

export const DEFAULT_BASE_URL = "https://www.salesasaservice.at";

type Env = Readonly<Record<string, string | undefined>>;

export function loadConfig(env: Env = process.env): KitConfig {
  return {
    baseUrl: (env.SAAS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    sessionFile: env.SAAS_SESSION_FILE,
    credentials: loadCredentials(env),
  };
}

function loadCredentials(env: Env): Credentials | undefined {
  if (env.SAAS_CREDENTIALS_FILE) {
    let parsed: Partial<Credentials>;
    try {
      parsed = JSON.parse(readFileSync(env.SAAS_CREDENTIALS_FILE, "utf8")) as Partial<Credentials>;
    } catch (cause) {
      throw new ConfigError(
        `cannot read SAAS_CREDENTIALS_FILE: ${cause instanceof Error ? cause.message : String(cause)}`,
        "CONFIG",
      );
    }
    if (!parsed.email || !parsed.password) {
      throw new ConfigError("SAAS_CREDENTIALS_FILE must contain email and password", "CONFIG");
    }
    return { email: parsed.email, password: parsed.password };
  }
  if (env.SAAS_EMAIL && env.SAAS_PASSWORD) return { email: env.SAAS_EMAIL, password: env.SAAS_PASSWORD };
  return undefined;
}
