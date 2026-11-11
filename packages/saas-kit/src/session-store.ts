import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { CookieJar } from "./cookies.js";

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
    const parsed = JSON.parse(readFileSync(this.file, "utf8")) as { cookies?: CookieJar };
    return parsed.cookies ?? {};
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
