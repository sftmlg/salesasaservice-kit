import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { CookieJar } from "./cookies.js";
import { ConfigError } from "./errors.js";
import { parseSecretJson } from "./secret-json.js";

const sessionFileSchema = z.object({ cookies: z.record(z.string(), z.string()).default({}) });

export interface SessionStore {
  load(): CookieJar;
  save(jar: CookieJar): void;
}

export class MemorySessionStore implements SessionStore {
  private jar: CookieJar = {};
  load(): CookieJar {
    return { ...this.jar };
  }
  save(jar: CookieJar): void {
    this.jar = { ...jar };
  }
}

export class FileSessionStore implements SessionStore {
  constructor(private readonly file: string) {}

  load(): CookieJar {
    if (!existsSync(this.file)) return {};
    const raw = parseSecretJson(this.readFile(), "the session file", "SESSION_FILE");
    const parsed = sessionFileSchema.safeParse(raw);
    if (!parsed.success)
      throw new ConfigError("the session file must hold a cookies object", { code: "SESSION_FILE" });
    return parsed.data.cookies;
  }

  private readFile(): string {
    try {
      return readFileSync(this.file, "utf8");
    } catch (cause) {
      throw new ConfigError("cannot read the session file", { code: "SESSION_FILE", cause });
    }
  }

  save(jar: CookieJar): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(
      this.file,
      `${JSON.stringify({ cookies: jar, updated: new Date().toISOString() }, null, 2)}\n`,
      {
        mode: 0o600,
      },
    );
    chmodSync(this.file, 0o600);
  }
}
