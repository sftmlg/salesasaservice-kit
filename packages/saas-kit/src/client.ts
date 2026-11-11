import type { Credentials } from "./config.js";
import { DEFAULT_BASE_URL } from "./config.js";
import { assertConfirmed } from "./confirm.js";
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

export interface SessionInfo {
  user: { id?: string; email?: string; name?: string; emailVerified?: boolean };
  session: { expiresAt?: string };
}

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

  async http(
    path: string,
    init: { method?: "GET" | "POST"; body?: string; accept?: string; auth?: boolean } = {},
  ): Promise<HttpResult> {
    const headers: Record<string, string> = {
      "user-agent": USER_AGENT,
      accept: init.accept ?? "application/json",
      origin: this.baseUrl,
      referer: `${this.baseUrl}/de`,
    };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (init.auth !== false) {
      const cookie = cookieHeader(this.store.load());
      if (cookie) headers.cookie = cookie;
    }
    const requestInit: RequestInit = { method: init.method ?? "GET", headers, redirect: "manual" };
    if (init.body !== undefined) requestInit.body = init.body;
    const res = await this.doFetch(`${this.baseUrl}${path}`, requestInit);
    const setCookies = res.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) this.store.save(applySetCookies(this.store.load(), setCookies));
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
  }

  async signUp(input: { name: string; email: string; password: string; acceptTerms: true }): Promise<void> {
    const res = await this.http("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ ...input, callbackURL: "/de" }),
      auth: false,
    });
    if (res.status >= 400)
      throw new SaasError(
        `sign-up failed (HTTP ${res.status}): ${res.text.slice(0, 300)}`,
        "SIGN_UP_FAILED",
        res.status,
      );
  }

  async signIn(credentials: Credentials): Promise<SessionInfo> {
    const res = await this.http("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify(credentials),
      auth: false,
    });
    if (res.status >= 400)
      throw new SaasError(
        `sign-in failed (HTTP ${res.status}): ${res.text.slice(0, 300)}`,
        "SIGN_IN_FAILED",
        res.status,
      );
    const session = await this.getSession();
    if (!session) {
      throw new NotSignedInError(
        "sign-in returned no session (email verification pending?)",
        "NO_SESSION",
        res.status,
      );
    }
    return session;
  }

  async verifyEmail(link: string): Promise<void> {
    const url = new URL(link);
    if (url.origin !== this.baseUrl) {
      throw new SaasError(
        `verification link points to ${url.origin}, expected ${this.baseUrl}`,
        "FOREIGN_LINK",
      );
    }
    const res = await this.http(`${url.pathname}${url.search}`, { accept: "text/html" });
    if (res.status >= 400)
      throw new SaasError(`verification failed (HTTP ${res.status})`, "VERIFY_FAILED", res.status);
  }

  async getSession(): Promise<SessionInfo | null> {
    const res = await this.http("/api/auth/get-session");
    if (res.status >= 400)
      throw new UnexpectedResponseError(
        `get-session answered HTTP ${res.status}`,
        "SESSION_HTTP",
        res.status,
      );
    const parsed = parseJson(res.text) as Partial<SessionInfo> | null;
    if (!parsed?.user) return null;
    return { user: parsed.user, session: parsed.session ?? {} };
  }

  async query(procedure: string, input?: unknown): Promise<unknown> {
    const res = await this.http(queryPath(procedure, input));
    return unwrapEnvelope(res.status, res.text);
  }

  async mutate(procedure: string, input: unknown, options: { confirm: boolean }): Promise<unknown> {
    assertConfirmed(options.confirm, `mutation ${procedure}`);
    const { path, body } = mutationRequest(procedure, input);
    const res = await this.http(path, { method: "POST", body });
    return unwrapEnvelope(res.status, res.text);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
