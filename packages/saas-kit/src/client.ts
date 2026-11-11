import { z } from "zod";
import type { Credentials } from "./config.js";
import { DEFAULT_BASE_URL } from "./config.js";
import { assertConfirmed, assertLegalActAllowed, assertSignUpAllowed } from "./confirm.js";
import { applySetCookies, cookieHeader } from "./cookies.js";
import { NotSignedInError, SaasError, UnexpectedResponseError } from "./errors.js";
import { MemorySessionStore, type SessionStore } from "./session-store.js";
import { mutationRequest, queryPath, unwrapEnvelope } from "./trpc.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  baseUrl?: string;
  fetch?: FetchLike;
  store?: SessionStore;
}

export interface HttpResult {
  status: number;
  location: string | null;
  text: string;
}

const sessionSchema = z
  .object({
    user: z.object({
      id: z.string().optional(),
      email: z.string().optional(),
      name: z.string().optional(),
      emailVerified: z.boolean().optional(),
    }),
    session: z
      .object({ expiresAt: z.string().optional(), activeWorkspaceId: z.string().nullish() })
      .default({}),
  })
  .nullable();

export type SessionInfo = NonNullable<z.infer<typeof sessionSchema>>;

const USER_AGENT = "salesasaservice-kit/0.1 (+unofficial headless client)";

export class SaasClient {
  readonly baseUrl: string;
  private readonly doFetch: FetchLike;
  private readonly store: SessionStore;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.doFetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.store = options.store ?? new MemorySessionStore();
  }

  async http(path: string, init: { accept?: string; auth?: boolean } = {}): Promise<HttpResult> {
    return this.send(path, init);
  }

  private async send(
    path: string,
    init: { method?: "GET" | "POST"; body?: string; accept?: string; auth?: boolean } = {},
  ): Promise<HttpResult> {
    if (!path.startsWith("/")) {
      throw new SaasError(`path "${path}" must start with "/" to stay on ${this.baseUrl}`, {
        code: "BAD_PATH",
      });
    }
    const cookie = init.auth === false ? "" : cookieHeader(this.store.load());
    const headers = {
      "user-agent": USER_AGENT,
      accept: init.accept ?? "application/json",
      origin: this.baseUrl,
      referer: `${this.baseUrl}/de`,
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    };
    const requestInit: RequestInit = { method: init.method ?? "GET", headers, redirect: "manual" };
    if (init.body !== undefined) requestInit.body = init.body;
    const res = await this.doFetch(`${this.baseUrl}${path}`, requestInit);
    const setCookies = res.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) this.store.save(applySetCookies(this.store.load(), setCookies));
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
  }

  async signUp(
    input: { name: string; email: string; password: string; acceptTerms: true },
    options: { legalAct: true },
  ): Promise<void> {
    assertSignUpAllowed(options?.legalAct);
    const res = await this.send("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ ...input, callbackURL: "/de" }),
      auth: false,
    });
    if (res.status >= 400)
      throw new SaasError(`sign-up failed (HTTP ${res.status}): ${res.text.slice(0, 300)}`, {
        code: "SIGN_UP_FAILED",
        httpStatus: res.status,
      });
  }

  async signIn(credentials: Credentials): Promise<SessionInfo> {
    const res = await this.send("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify(credentials),
      auth: false,
    });
    if (res.status >= 400)
      throw new SaasError(`sign-in failed (HTTP ${res.status}): ${res.text.slice(0, 300)}`, {
        code: "SIGN_IN_FAILED",
        httpStatus: res.status,
      });
    const session = await this.getSession();
    if (!session) {
      throw new NotSignedInError("sign-in returned no session (email verification pending?)", {
        code: "NO_SESSION",
        httpStatus: res.status,
      });
    }
    return session;
  }

  async verifyEmail(link: string): Promise<void> {
    const url = new URL(link);
    if (url.origin !== this.baseUrl) {
      throw new SaasError(`verification link points to ${url.origin}, expected ${this.baseUrl}`, {
        code: "FOREIGN_LINK",
      });
    }
    const res = await this.http(`${url.pathname}${url.search}`, { accept: "text/html" });
    if (res.status >= 400)
      throw new SaasError(`verification failed (HTTP ${res.status})`, {
        code: "VERIFY_FAILED",
        httpStatus: res.status,
      });
  }

  async getSession(): Promise<SessionInfo | null> {
    const res = await this.http("/api/auth/get-session");
    if (res.status >= 400)
      throw new UnexpectedResponseError(`get-session answered HTTP ${res.status}`, {
        code: "SESSION_HTTP",
        httpStatus: res.status,
      });
    const parsed = sessionSchema.safeParse(parseJson(res.text));
    if (!parsed.success) {
      throw new UnexpectedResponseError(`get-session answered an unknown shape: ${res.text.slice(0, 200)}`, {
        code: "SESSION_SHAPE",
        httpStatus: res.status,
      });
    }
    return parsed.data;
  }

  async query(procedure: string, input?: unknown): Promise<unknown> {
    const res = await this.http(queryPath(procedure, input));
    return unwrapEnvelope(res.status, res.text);
  }

  async mutate(
    procedure: string,
    input: unknown,
    options: { confirm: boolean; legalAct?: boolean },
  ): Promise<unknown> {
    assertLegalActAllowed(procedure, options.legalAct);
    assertConfirmed(options.confirm, `mutation ${procedure}`);
    const { path, body } = mutationRequest(procedure, input);
    const res = await this.send(path, { method: "POST", body });
    return unwrapEnvelope(res.status, res.text);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
