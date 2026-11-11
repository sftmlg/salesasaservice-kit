import type { FetchLike } from "../src/client.js";

export interface Recorded {
  url: string;
  method: string;
  headers: Headers;
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
      headers: new Headers(init?.headers),
      body: init?.body as string | undefined,
    };
    calls.push(req);
    const answer = reply(req);
    const spec: FakeReply = typeof answer === "string" ? { body: answer } : answer;
    const headers = new Headers();
    for (const cookie of spec.setCookie ?? []) headers.append("set-cookie", cookie);
    if (spec.location) headers.set("location", spec.location);
    return new Response(spec.body ?? "", { status: spec.status ?? 200, headers });
  };
  return { fetch, calls };
}

export const okReply = (data: unknown) => JSON.stringify([{ result: { data } }]);
export const trpcError = (code: string, httpStatus: number, message = code) =>
  JSON.stringify([{ error: { message, code: -32000, data: { code, httpStatus } } }]);
