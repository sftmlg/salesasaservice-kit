import type { Catalogue } from "./discovery.js";

const batchRef = { $ref: "#/components/parameters/batch" };

export function buildOpenApi(catalogue: Catalogue, baseUrl: string): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const [name, { kind, observed }] of Object.entries(catalogue.procedures)) {
    const operation = {
      operationId: name.replace(".", "_"),
      tags: [name.split(".")[0]],
      summary: `${kind} ${name}`,
      description: `Observed server answer to a GET with null input: ${observed}. Input schema not published by the platform.`,
      security: [{ sessionCookie: [] }],
      responses: {
        200: {
          description: "tRPC batch result",
          content: { "application/json": { schema: { $ref: "#/components/schemas/BatchResult" } } },
        },
        default: {
          description: "tRPC error envelope",
          content: { "application/json": { schema: { $ref: "#/components/schemas/BatchError" } } },
        },
      },
    };
    paths[`/api/trpc/${name}`] =
      kind === "query"
        ? { get: { ...operation, parameters: [batchRef, { $ref: "#/components/parameters/input" }] } }
        : {
            post: {
              ...operation,
              parameters: [batchRef],
              requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/BatchInput" } } },
              },
            },
          };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Sales as a Service tRPC API (unofficial)",
      version: catalogue.measured,
      description:
        "Unofficial description of the tRPC endpoints the salesasaservice.at web app calls. Derived from the client bundles and read-only probes; not published or endorsed by the platform. An account without a finished onboarding gets PRECONDITION_FAILED from workspace procedures; one with a workspace gets the procedure's own answer.",
    },
    servers: [{ url: baseUrl }],
    paths: { ...authPaths(), ...paths },
    components: components(),
  };
}

const jsonBody = (schema: unknown) => ({ required: true, content: { "application/json": { schema } } });

function authPaths(): Record<string, unknown> {
  return {
    "/api/auth/sign-up/email": {
      post: {
        tags: ["auth"],
        operationId: "auth_signUpEmail",
        summary: "Create an account (better-auth)",
        requestBody: jsonBody({
          type: "object",
          required: ["name", "email", "password", "acceptTerms"],
          properties: {
            name: { type: "string", minLength: 2 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 15 },
            acceptTerms: { const: true },
            callbackURL: { type: "string" },
          },
        }),
        responses: {
          200: { description: "User created, email verification pending" },
          400: { description: "e.g. TERMS_NOT_ACCEPTED" },
        },
      },
    },
    "/api/auth/sign-in/email": {
      post: {
        tags: ["auth"],
        operationId: "auth_signInEmail",
        summary: "Sign in, sets the session cookie",
        requestBody: jsonBody({
          type: "object",
          required: ["email", "password"],
          properties: { email: { type: "string" }, password: { type: "string" } },
        }),
        responses: { 200: { description: "Signed in" }, 403: { description: "EMAIL_NOT_VERIFIED" } },
      },
    },
    "/api/auth/get-session": {
      get: {
        tags: ["auth"],
        operationId: "auth_getSession",
        summary: "Current user and session, null when signed out",
        responses: { 200: { description: "Session or null" } },
      },
    },
    "/api/auth/verify-email": {
      get: {
        tags: ["auth"],
        operationId: "auth_verifyEmail",
        summary: "Confirm the email address with the mailed token",
        parameters: [
          { name: "token", in: "query", required: true, schema: { type: "string" } },
          { name: "callbackURL", in: "query", schema: { type: "string" } },
        ],
        responses: { 302: { description: "Verified, redirect to callbackURL" } },
      },
    },
  };
}

function components(): Record<string, unknown> {
  return {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "__Secure-better-auth.session_token",
        description: "Set by sign-in; POSTs also need an Origin header matching the site.",
      },
    },
    parameters: {
      batch: { name: "batch", in: "query", required: true, schema: { const: "1" } },
      input: {
        name: "input",
        in: "query",
        required: true,
        description: 'JSON object keyed by batch index, e.g. {"0":{...}}',
        schema: { type: "string" },
      },
    },
    schemas: {
      BatchInput: {
        type: "object",
        description: 'Keyed by batch index, e.g. {"0":{...}}; plain JSON, no transformer',
        additionalProperties: true,
      },
      BatchResult: {
        type: "array",
        items: { type: "object", properties: { result: { type: "object", properties: { data: {} } } } },
      },
      BatchError: {
        type: "array",
        items: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                message: { type: "string" },
                code: { type: "integer", examples: [-32004, -32012, -32001, -32600] },
                data: {
                  type: "object",
                  properties: {
                    code: {
                      type: "string",
                      examples: [
                        "NOT_FOUND",
                        "PRECONDITION_FAILED",
                        "UNAUTHORIZED",
                        "BAD_REQUEST",
                        "METHOD_NOT_SUPPORTED",
                      ],
                    },
                    httpStatus: { type: "integer" },
                    path: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
