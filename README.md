# salesasaservice-kit

A typed TypeScript client, an MCP server and an API reference for the Sales as a Service marketplace (https://www.salesasaservice.at/), for working with it headlessly from the business-partner side.

**Unofficial.** This kit and its documentation are derived from the platform's web app. They are not published, reviewed or endorsed by the platform and can break when it changes.

The README has three parts: [who we are](#1-about-software-moling), [the kit](#2-the-kit) and [the documentation](#3-documentation).

## 1. About Software Moling

Software Moling is a consultancy led by David Moling, based in Innsbruck, Austria, working remotely. We design and build software and AI systems for organisations that need technology that keeps working over time: AI platforms and automation, enterprise software architecture, AI strategy and consulting, assistants, and integration with existing systems.

We care about digital sovereignty (data and AI infrastructure stay under the client's control) and build GDPR and EU AI Act compliance into designs from the start. Our approach is systems that fit existing operations instead of replacing them. More at https://www.software-moling.com/.

We built this kit because the marketplace has no public API, and working with it by hand does not scale. It lets a business partner, or an agent acting for them, read the platform's state and act on it in a controlled way, and it documents what we learned so others do not have to rediscover it.

## 2. The kit

One package, `packages/saas-kit`, with a library and two executables.

| Part                               | What it does                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Client (`SaasClient`)              | better-auth sign-up, sign-in and email verification, cookie jar, tRPC query and mutation, session store                                                                  |
| Discovery                          | crawls the signed-in app, extracts procedure names, probes them with `GET` only                                                                                          |
| OpenAPI                            | generates the OpenAPI 3.1 file and the catalogue page from the bundled catalogue                                                                                         |
| MCP server (`saas-kit-mcp`, stdio) | exposes the platform as tools                                                                                                                                            |
| CLI (`saas-kit`)                   | `status`, `login`, `discover`, `list`, `probe` (GET every catalogued procedure, prints the answer codes), `query`, `mutation --confirm [--legal-act]`, `docs`, `refresh` |

### Setup

```
pnpm install
pnpm build
```

### Configuration

Everything comes from environment variables. No secret is read from the repository and none is committed.

| Variable                      | Purpose                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `SAAS_CREDENTIALS_FILE`       | path to a JSON file `{ "email": "...", "password": "..." }` kept outside the repository     |
| `SAAS_EMAIL`, `SAAS_PASSWORD` | alternative to the file (the file wins if both are set)                                     |
| `SAAS_SESSION_FILE`           | where the session cookie is stored (mode 0600); without it the session lives in memory only |
| `SAAS_BASE_URL`               | defaults to `https://www.salesasaservice.at`                                                |

### MCP server

```json
{
  "mcpServers": {
    "salesasaservice": {
      "command": "node",
      "args": ["packages/saas-kit/dist/mcp-server.js"],
      "env": {
        "SAAS_CREDENTIALS_FILE": "/path/outside/the/repo/credentials.json",
        "SAAS_SESSION_FILE": "/path/outside/the/repo/session.json"
      }
    }
  }
}
```

| Tool              | Effect                                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_status`  | whether a session exists, for whom, until when                                                                                                                       |
| `login`           | sign in with the configured credentials and store the session                                                                                                        |
| `discover`        | crawl the signed-in app and list procedures and routes (read-only)                                                                                                   |
| `list_procedures` | the bundled catalogue, filterable by router and kind                                                                                                                 |
| `query`           | call a tRPC query (HTTP `GET`, cannot write)                                                                                                                         |
| `mutation`        | call a tRPC mutation; **refused unless `confirm` is `true`**, which is for after the account holder approved the exact input; **legal acts are always refused here** |

Account creation is deliberately not a tool: it accepts the platform's terms on behalf of a person. It exists in the client library as `signUp`, which requires `acceptTerms: true` and the explicit option `legalAct: true` (`client.signUp(input, { legalAct: true })`); only call it after that person decided to accept the terms.

### Legal acts

`confirm=true` is set by whoever calls the tool, and an agent reads text that the platform or a counterparty controls, so that text can steer an agent into a legal act in the account holder's name. Ten procedures are therefore gated a second time (`LEGAL_ACT_PROCEDURES`, `packages/saas-kit/src/legal-acts.ts`):

`contracts.signWorkspaceContract`, `opportunities.acceptRequest`, `opportunities.acceptClose`, `opportunities.rejectClose`, `commission.confirmBusinessDetails`, `commission.requestPayout`, `commission.updateBankDetails`, `subscriptions.createCheckout`, `offers.send`, `onboarding.createWorkspace`.

- `client.mutate` refuses them unless the caller passes `legalAct: true` besides `confirm: true`.
- The MCP server never passes it and refuses them with `LEGAL_ACT_REFUSED`.
- The CLI accepts them only as `saas-kit mutation <router.name> [json] --confirm --legal-act`.

Details: [docs/api-reference.md](docs/api-reference.md#legal-acts).

### Library

```ts
import { SaasClient, FileSessionStore } from "@software-moling/salesasaservice-kit";

const client = new SaasClient({ store: new FileSessionStore(process.env.SAAS_SESSION_FILE ?? "") });
await client.signIn({ email, password });
const status = await client.query("subscriptions.getStatus");
await client.mutate("listings.publish", input, { confirm: true });
await client.mutate("offers.send", input, { confirm: true, legalAct: true }); // a legal act, see below
```

### Development

`pnpm check` runs typecheck, Biome and the tests. Tests live in `packages/saas-kit/tests`, run against a fake `fetch` (no network), and each test name states the bug it would catch. The catalogue's single source is `packages/saas-kit/data/procedures.json`; `docs/openapi.json` and `docs/procedure-catalogue.md` are generated from it with `saas-kit docs`, and a test fails if they drift. Biome runs the strict preset (rules as errors plus the `short-identifier.grit` plugin, which every `biome.json` that lints code lists in its own `plugins`); `lint-gate.test.ts` plants a one-letter binding and requires the plugin finding, so the plugin cannot go blind.

## 3. Documentation

- [docs/api-reference.md](docs/api-reference.md): overview, authentication flow, request and error envelope, onboarding gate
- [docs/procedure-catalogue.md](docs/procedure-catalogue.md): procedures grouped by router, with method and how each was confirmed
- [docs/openapi.json](docs/openapi.json): OpenAPI 3.1 description

All of it is an unofficial description derived from the web app; input schemas are not published by the platform and are left open.
