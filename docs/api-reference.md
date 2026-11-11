# Sales as a Service tRPC interface: unofficial reference

This is an unofficial description of the HTTP interface that the web app at https://www.salesasaservice.at/ uses for business partners. It was derived from the app's public client bundles and from read-only requests. It is not published, reviewed or endorsed by the platform, it can change without notice, and anything not listed here has not been observed.

Machine-readable form: [openapi.json](openapi.json) (OpenAPI 3.1). Procedure list: [procedure-catalogue.md](procedure-catalogue.md).

## Overview

| Concern        | What was observed                                                                        |
| -------------- | ---------------------------------------------------------------------------------------- |
| Web framework  | Next.js                                                                                  |
| Authentication | better-auth under `/api/auth`, session in a cookie                                       |
| Data           | tRPC under `/api/trpc`, no data transformer (plain JSON)                                 |
| Batching       | every call is a batch of one: `batch=1`, payload keyed by index `0`                      |
| Scope          | the catalogue covers the business-partner side; sales-agent procedures are not described |

## Authentication flow

1. `POST /api/auth/sign-up/email` with `name`, `email`, `password` (at least 15 characters), `acceptTerms: true` and an optional `callbackURL`. Without `acceptTerms` the answer is `TERMS_NOT_ACCEPTED`. Accepting terms is a legal act of the account holder, so a person must decide it.
2. The platform mails a verification link of the form `/api/auth/verify-email?token=...&callbackURL=...`. Open it (GET) to confirm the address. Until then sign-in answers `EMAIL_NOT_VERIFIED` (HTTP 403).
3. `POST /api/auth/sign-in/email` with `email` and `password`. The answer sets the session cookie (`__Secure-better-auth.session_token`).
4. `GET /api/auth/get-session` returns the user and session, or `null` when signed out.

Every `POST` must carry an `Origin` header equal to the site origin; better-auth refuses it otherwise. The kit sends `Origin` on all requests and keeps the cookie in a jar that follows `Set-Cookie` (including expiry and `Max-Age=0` deletion).

## Request envelope

Query (HTTP `GET`):

```
GET /api/trpc/<router>.<procedure>?batch=1&input={"0":<json or null>}
```

Mutation (HTTP `POST`):

```
POST /api/trpc/<router>.<procedure>?batch=1
content-type: application/json

{"0":<json or null>}
```

The `input` query value is URL-encoded JSON. Send `null` for "no input"; an omitted key is not equivalent.

## Response and error envelope

Success is an array with one item:

```json
[{ "result": { "data": {} } }]
```

Failure is an array with one item holding an `error`; the HTTP status is repeated in `data.httpStatus`:

```json
[
  {
    "error": {
      "message": "...",
      "code": -32004,
      "data": { "code": "NOT_FOUND", "httpStatus": 404, "path": "x.y" }
    }
  }
]
```

| `data.code`            | HTTP | Meaning in practice                                                                |
| ---------------------- | ---- | ---------------------------------------------------------------------------------- |
| `NOT_FOUND`            | 404  | Unknown procedure name. Cheap to use for checking whether a name is real.          |
| `METHOD_NOT_SUPPORTED` | 405  | The procedure exists but is a mutation; a `GET` is refused and nothing is written. |
| `PRECONDITION_FAILED`  | 412  | The procedure exists but the account has not finished onboarding.                  |
| `UNAUTHORIZED`         | 401  | No valid session.                                                                  |
| `BAD_REQUEST`          | 400  | Input did not validate.                                                            |

## Onboarding gate

Workspace procedures answer `PRECONDITION_FAILED` ("Onboarding state does not allow this operation") until the account has completed: company profile with legal details, verification (automatic when a VAT id is given, otherwise an identity document), and the platform contract including a declaration of signing authority. Most of these steps are legal acts of the account holder and cannot be done by the kit.

## Input schemas

The platform does not publish input schemas, so none are described. A schema is only added once a call with that input has actually been observed.

## How the catalogue was confirmed

Procedure names are extracted from the client bundles. A name counts as confirmed when a read-only `GET` with `null` input does not answer `NOT_FOUND`. The extraction also yields minifier noise, which this probe filters out. The catalogue lists the answer observed for each name (see the table meanings in [procedure-catalogue.md](procedure-catalogue.md)). Regenerate it with `saas-kit refresh` and the two documentation files with `saas-kit docs`.

## Using the interface safely

- Prefer queries; they cannot write.
- A mutation changes data that other parties on the platform see. The kit only sends one with an explicit `confirm`, to be given after the account holder approved the exact input.
- Keep credentials and the session cookie out of version control.
