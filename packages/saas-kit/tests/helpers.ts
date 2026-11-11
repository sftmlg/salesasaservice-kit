import type { FetchLike } from "../src/client.js";

export interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

export interface FakeReply {
  status?: number;
  body?: string;
  setCookie?: string[];
  location?: string;
}

export function fakeFetch(reply: (req: Recorded) => FakeReply | string): {
  fetch: FetchLike;
  calls: Recorded[];
} {
  const calls: Recorded[] = [];
  const fetch: FetchLike = async (url, init) => {
    const req: Recorded = {
      url,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body as string | undefined,
    };
    calls.push(req);
    const r = reply(req);
    const spec: FakeReply = typeof r === "string" ? { body: r } : r;
    const headers = new Headers();
    for (const c of spec.setCookie ?? []) headers.append("set-cookie", c);
    if (spec.location) headers.set("location", spec.location);
    return new Response(spec.body ?? "", { status: spec.status ?? 200, headers });
  };
  return { fetch, calls };
}

export const ok = (data: unknown) => JSON.stringify([{ result: { data } }]);
export const trpcError = (code: string, httpStatus: number, message = code) =>
  JSON.stringify([{ error: { message, code: -32000, data: { code, httpStatus } } }]);
