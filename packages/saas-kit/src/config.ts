import { readFileSync } from "node:fs";
import { z } from "zod";
import { ConfigError } from "./errors.js";

const credentialsSchema = z.object({ email: z.string().min(1), password: z.string().min(1) });

export type Credentials = z.infer<typeof credentialsSchema>;

export interface KitConfig {
  baseUrl: string;
  sessionFile: string | undefined;
  credentials: Credentials | undefined;
}

export const DEFAULT_BASE_URL = "https://www.salesasaservice.at";

interface Env {
  readonly SAAS_BASE_URL?: string | undefined;
  readonly SAAS_SESSION_FILE?: string | undefined;
  readonly SAAS_CREDENTIALS_FILE?: string | undefined;
  readonly SAAS_EMAIL?: string | undefined;
  readonly SAAS_PASSWORD?: string | undefined;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ConfigError(`SAAS_BASE_URL is not a URL: ${trimmed}`, "CONFIG");
  }
  const secure = url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  if (!secure || url.pathname !== "/") {
    throw new ConfigError(
      "SAAS_BASE_URL must be an https origin without a path (http only for localhost)",
      "CONFIG",
    );
  }
  return url.origin;
}

export function loadConfig(env: Env = process.env): KitConfig {
  return {
    baseUrl: parseBaseUrl(env.SAAS_BASE_URL ?? DEFAULT_BASE_URL),
    sessionFile: env.SAAS_SESSION_FILE,
    credentials: loadCredentials(env),
  };
}

function loadCredentials(env: Env): Credentials | undefined {
  if (env.SAAS_CREDENTIALS_FILE) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(env.SAAS_CREDENTIALS_FILE, "utf8"));
    } catch (cause) {
      throw new ConfigError(
        `cannot read SAAS_CREDENTIALS_FILE: ${cause instanceof Error ? cause.message : String(cause)}`,
        "CONFIG",
      );
    }
    const parsed = credentialsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ConfigError("SAAS_CREDENTIALS_FILE must contain email and password", "CONFIG");
    }
    return parsed.data;
  }
  if (env.SAAS_EMAIL && env.SAAS_PASSWORD) return { email: env.SAAS_EMAIL, password: env.SAAS_PASSWORD };
  return undefined;
}
