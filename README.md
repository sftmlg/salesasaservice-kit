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

| Part                               | What it does                                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client (`SaasClient`)              | better-auth sign-up, sign-in and email verification, cookie jar, tRPC query and mutation, session store                                                                                               |
| Discovery                          | crawls the signed-in app, extracts procedure names, probes them with `GET` only                                                                                                                       |
| OpenAPI                            | generates the OpenAPI 3.1 file and the catalogue page from the bundled catalogue                                                                                                                      |
| MCP server (`saas-kit-mcp`, stdio) | exposes the platform as tools                                                                                                                                                                         |
| CLI (`saas-kit`)                   | `status`, `login`, `discover`, `list`, `probe` (GET every catalogued procedure, prints the answer codes), `query`, `catalogue`, `apply <file>`, `mutation --confirm [--legal-act]`, `docs`, `refresh` |

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

| Tool              | Effect                                                                                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_status`  | whether a session exists, for whom, until when                                                                                                                                                                                                                   |
| `login`           | sign in with the configured credentials and store the session                                                                                                                                                                                                    |
| `discover`        | crawl the signed-in app pages under `/de` and `/en` and list procedures and routes (read-only)                                                                                                                                                                   |
| `list_procedures` | the bundled catalogue, filterable by router and kind                                                                                                                                                                                                             |
| `query`           | call a tRPC query (HTTP `GET`, cannot write)                                                                                                                                                                                                                     |
| `mutation`        | call an allowlisted tRPC mutation (see [MCP allowlist](docs/api-reference.md#mcp-allowlist)); **refused unless `confirm` is `true`**, which is for after the account holder approved the exact input; **every other or unknown mutation is always refused here** |

Account creation is deliberately not a tool: it accepts the platform's terms on behalf of a person. It exists in the client library as `signUp`, which requires `acceptTerms: true` and the explicit option `legalAct: true` (`client.signUp(input, { legalAct: true })`); only call it after that person decided to accept the terms.

### Mutation policy

`confirm=true` is set by whoever calls the tool, and an agent reads text that the platform or a counterparty controls, so that text can steer an agent into a write in the account holder's name. Over MCP only the 14 allowlisted, reviewed working edits are accepted, with no delete among them. A record edit (activities, tasks, companies, contacts) overwrites the content of a record, but a created record stays in the account because no delete is reachable over MCP, and no `companies.*` or `contacts.*` correction path is observed in the catalogue; a staged logo upload can be cancelled, a completed one cannot be undone over MCP; the two inbox acknowledgements are read marks with no catalogued undo (the list is `MCP_ALLOWED_MUTATIONS` in `packages/saas-kit/src/legal-acts.ts`, printed in [docs/api-reference.md](docs/api-reference.md#mcp-allowlist)). Every other mutation, including an unknown name, the company's legal statements (`profile.updateInfo`, `profile.updateAddress`, `profile.updateUnlimitedPartners`), the listing commission terms and text (`listings.update`, `listingDefaults.save`) and everything that deletes or publishes, accepts, rejects, signs, sends, pays, subscribes, consents, removes users or submits, is refused over MCP with `LEGAL_ACT_REFUSED`.

- `client.mutate` refuses a non-allowlisted mutation unless the caller passes `legalAct: true` besides `confirm: true`.
- The MCP server never passes it.
- The CLI accepts them only as `saas-kit mutation <router.name> [json] --confirm --legal-act`.
- `saas-kit apply <file>` writes products and listings and is a legal act as a whole; it is a CLI command only, with no MCP tool (see [Catalogue and apply](#catalogue-and-apply)).

Details: [docs/api-reference.md](docs/api-reference.md#mutation-policy).

### Catalogue and apply

`saas-kit catalogue` lists the account's own products and listings, read from the signed-in page `/de/business-partner/products-services` with one `GET` (the page's server-rendered data; no tRPC call, no write). It prints `products` (`id`, `itemType` `product` or `proposal`, `title`, `kind`, `priceLabel`, `price`, `unit`, `billingPeriod`, `listingCount`) and `listings` (`id`, `productId`, `productTitle`, `title`, `status`, `priceLabel`, `price`, `unit`, `billingPeriod`, `region`, `commissionLabel`, `commissionMode`, `commissionValue`). The page shows price and commission only as formatted labels, so the kit parses them (`1.500 € / piece, one-time` becomes price `1500`); a label it cannot read stays visible as its raw text with null parsed fields. A listing is linked to its product by title, because the page gives no product id on a listing. Page shape and the observed label formats: [docs/api-reference.md](docs/api-reference.md#products-and-listings-page).

`saas-kit apply <file> [--publish] [--confirm --legal-act]` takes a JSON array of `{ "key", "product", "listing" }`, where `product` is the `products.create` input and `listing` the `listings.create` input without `productId`.

- It reads the catalogue page, matches existing products by title (surrounding spaces ignored; an AI proposal is not a product), and plans per entry: create what is missing, update what differs, leave the rest.
- Default: a dry run. It prints the plan with `from`/`to` per changed field and sends nothing but that one `GET`.
- Both `--confirm` and `--legal-act` are required to write; one of them alone is refused before any request. It creates and edits records that sales agents see, so it is a legal act in the account holder's name. There is no MCP tool for it.
- Order: `products.create` and `products.update`, then (after re-reading the page for the ids of new products) `listings.create` and `listings.update`. `listings.publish` runs only with `--publish`, and only for listings the page does not show as published.
- It stops at the first failed write and names the steps that were done. Running it again continues, because records are matched by title.
- Only what the page shows decides whether an update is needed: product `kind`, `pricePerBlockEuros`, `unit`, `billingPeriod`; listing `titleOverride`, `region`, `commissionMode`, `commissionValue`. Every other field you give is sent when the record is written for another reason, but a change in it alone is not detected; the dry run says so.
- Not observed: the answers of the create calls (the kit does not use them; ids are read back from the page), the input of `listings.publish` (the kit sends `{ "id": <listing id> }` and a different schema surfaces as a platform validation error), the commission label of a fixed commission, and a price with a block size other than 1.

### Library

```ts
import { SaasClient, FileSessionStore } from "@software-moling/salesasaservice-kit";

const client = new SaasClient({ store: new FileSessionStore(process.env.SAAS_SESSION_FILE ?? "") });
await client.signIn({ email, password });
const status = await client.query("subscriptions.getStatus");
await client.mutate("activities.createTask", input, { confirm: true }); // on the allowlist
await client.mutate("listings.update", input, { confirm: true, legalAct: true }); // not on the allowlist, see Mutation policy
```

### Development

`pnpm check` runs typecheck, Biome and the tests. Tests live in `packages/saas-kit/tests`, run against a fake `fetch` (no network), and each test name states the bug it would catch. The catalogue's single source is `packages/saas-kit/data/procedures.json`; `docs/openapi.json` and `docs/procedure-catalogue.md` are generated from it with `saas-kit docs`, and a test fails if they drift. Biome runs the strict preset (rules as errors plus the `short-identifier.grit` plugin, which every `biome.json` that lints code lists in its own `plugins`); `lint-gate.test.ts` plants a one-letter binding and requires the plugin finding, so the plugin cannot go blind.

## 3. Documentation

- [docs/api-reference.md](docs/api-reference.md): overview, authentication flow, request and error envelope, onboarding gate, mutation policy
- [docs/procedure-catalogue.md](docs/procedure-catalogue.md): procedures grouped by router, with method and how each was confirmed
- [docs/openapi.json](docs/openapi.json): OpenAPI 3.1 description

All of it is an unofficial description derived from the web app; input schemas are not published by the platform and are left open.
