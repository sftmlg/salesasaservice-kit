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

1. `POST /api/auth/sign-up/email` with `name`, `email`, `password` (at least 15 characters), `acceptTerms: true` and an optional `callbackURL`. Without `acceptTerms` the answer is `TERMS_NOT_ACCEPTED`. Accepting terms is a legal act of the account holder, so a person must decide it; the kit's `signUp` therefore requires `legalAct: true` and is not an MCP tool.
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

The `input` query value is URL-encoded JSON. A procedure without input (void input, for example the query `subscriptions.getStatus` or the mutation `verification.startWorkspaceVerification`) takes `input={}` or the body `{}`, with no `0` key; `{"0":null}` is a different request and is answered with `expected void, received null`. Send `{"0":null}` only for a procedure whose input is nullable.

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
| `FORBIDDEN`            | 403  | The procedure exists but the account lacks the role or permission.                 |
| `UNAUTHORIZED`         | 401  | No valid session.                                                                  |
| `BAD_REQUEST`          | 400  | Input did not validate.                                                            |

## Onboarding gate

For an account that has not finished onboarding, workspace procedures answer `PRECONDITION_FAILED` ("Onboarding state does not allow this operation") until it has completed: company profile with legal details, verification (automatic when a VAT id is given, otherwise an identity document), and the platform contract including a declaration of signing authority. Most of these steps are legal acts of the account holder and cannot be done by the kit. Once the account has a business-partner workspace the gated queries answer with their own result or error (`BAD_REQUEST` when the input does not validate, `FORBIDDEN` for a missing role) instead. Two mutations belong to this flow: `onboarding.createWorkspace` creates the workspace, and `verification.startWorkspaceVerification` (void input) starts its verification. Both are legal acts of the account holder; the kit lists them and sends `onboarding.createWorkspace` only behind the legal-act guard (see [Legal acts](#legal-acts)).

### Order for a business partner

1. `onboarding.createWorkspace` with type `business_partner`.
2. `profile.updateInfo` (company data) and `profile.updateAddress`.
3. Verification: `verification.startWorkspaceVerification`; it completes automatically when the profile carries a VAT id, otherwise an identity document is needed.
4. The platform contract (`contracts.signWorkspaceContract`), which includes the declaration of signing authority.
5. Listings. They can be placed before the contract is signed and then show as "coming soon".

An account with a workspace, a complete profile and approved verification but no signed contract already gets real answers from the workspace queries below; the commission dashboard, history, payouts and positions answer `FORBIDDEN` (`not_authorized`) for such an account (the cause was not isolated further).

## Input schemas

The platform does not publish input schemas. A schema is documented here only after a call with that input has been observed against the live platform; everything else is left open. Zod's validation errors name missing fields, which is how most shapes below were found.

### Mutations

Observed live: the four onboarding mutations below were called on 2026-11-11 by the account owner with exactly the input documented here, and each returned success. The shapes are taken from those calls, not from a list of field names.

| Procedure                                 | Input                                                                                                       | Observed live (2026-11-11)                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `onboarding.createWorkspace`              | `type` (`business_partner` or `sales_agent`), `legalName`, `website`, `websiteConfirmed`, `proposeProducts` | success: a workspace id, with the caller's role `bp_owner`     |
| `verification.startWorkspaceVerification` | void: body `{}`                                                                                             | success: verification status `approved`                        |
| `profile.updateAddress`                   | `street`, `postalCode`, `city`, `country` (ISO country code, for example `AT`)                              | `{"success":true}`; sending the current values changes nothing |
| `profile.updateInfo`                      | see below                                                                                                   | `{"success":true}`                                             |

`profile.updateInfo` fields (observed live): `companiesRegisterCourt`, `companiesRegisterNumber`, `companiesRegisterStatus` (`registered` or `not_registered`), `contactEmail`, `contactPhone`, `displayName`, `formationStatus` (`established` or `in_formation`), `gisaNumber`, `hasNaturalPersonUnlimitedPartner` (boolean or `null`), `inLiquidation` (boolean or `null`), `legalForm` (`gmbh`, `flexkapg`, `ag`, `og`, `kg`, `gmbh_co_kg`, `sole_proprietor`, `gesbr` or `other`), `legalName`, `otherLegalForm`, `proprietorName`, `vatId`, `website`, `websiteConfirmed`. Text fields that do not apply take empty strings; `null` is rejected.

### Queries

Queries without input send `input={}` (see the request envelope). The workspace id the queries need is `session.activeWorkspaceId` from `GET /api/auth/get-session` (`saas-kit status` prints it).

| Procedure                                                                                                                                                                                   | Input                                                                                                     | Observed answer (account with workspace, no signed contract)                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subscriptions.getStatus`                                                                                                                                                                   | void                                                                                                      | `access` (`status`, `workspaceType`), `canCancelAtPeriodEnd`, `canManageBilling`, `canOpenBillingPortal`, `offeredPackage`, `pendingOperation`                                                                                                                                |
| `commission.getFinancialProfile`                                                                                                                                                            | void                                                                                                      | `businessIdentity` (`legalName`, `street`, `postalCode`, `city`, `country`, `vatId`, `companiesRegisterNumber`, `gisaNumber`), `profile` (the same identity, plus `classification` and `source`), `taxOverride`, `bank`, `businessConfirmationId`, `selfBillingClauseVersion` |
| `commission.listInvoices`                                                                                                                                                                   | object, `{}` accepted                                                                                     | `{"items":[],"nextCursor":null}`                                                                                                                                                                                                                                              |
| `inbox.listFinancial`                                                                                                                                                                       | object, `{}` accepted                                                                                     | `[]`                                                                                                                                                                                                                                                                          |
| `inbox.listActive`                                                                                                                                                                          | `workspaceId`                                                                                             | `[]`                                                                                                                                                                                                                                                                          |
| `inbox.listProductProposalFailures`                                                                                                                                                         | `workspaceId`                                                                                             | `[]`                                                                                                                                                                                                                                                                          |
| `activities.list`                                                                                                                                                                           | `context`: `{"kind":"crm"}`, `{"kind":"listing","listingId"}` or `{"kind":"opportunity","opportunityId"}` | `[]` for `crm`                                                                                                                                                                                                                                                                |
| `opportunities.listMessages`, `opportunities.listRequestHistory`, `opportunities.getRequestSnapshot`, `offers.listByOpportunity`, `offers.getSendRecipients`, `offers.getSignedDownloadUrl` | `opportunityId`                                                                                           | `listMessages` and `listByOpportunity` answer `NOT_FOUND` ("Deal room not found", "Offer not found") for an unknown id; none was observed with a real deal room                                                                                                               |
| `offers.getDownloadUrl`                                                                                                                                                                     | `offerId`, `opportunityId`                                                                                | not observed with a real offer                                                                                                                                                                                                                                                |
| `offers.getCertificateDownloadUrl`                                                                                                                                                          | `acceptanceId`, `opportunityId`                                                                           | not observed with a real acceptance                                                                                                                                                                                                                                           |
| `commission.getDashboard`, `commission.getHistory`, `commission.listPayouts`, `commission.listPositions`                                                                                    | not determined                                                                                            | `FORBIDDEN` `not_authorized`                                                                                                                                                                                                                                                  |
| `opportunities.getSalesAgentDetail`, `opportunities.searchStagingCompanies`, `opportunities.searchStagingContacts`                                                                          | not determined                                                                                            | `FORBIDDEN`, "Requires one of: sa_owner; has: bp_owner" (sales-agent role only)                                                                                                                                                                                               |

## Known limits

These procedures need an existing deal (an opportunity with a deal room, an offer or an acceptance). Without a real deal an input cannot be observed: an unknown id only answers `NOT_FOUND`, and sending a mutation would act on a real counterparty. They are catalogued by name and kind and their inputs stay open; this is a limit of what can be exercised, not a gap in the reference.

- Offers: `offers.send`, `offers.reissueLink`, `offers.revokeLink`, `offers.startSignedUpload`, `offers.completeSignedUpload`, `offers.listByOpportunity`, `offers.getSendRecipients`, `offers.getDownloadUrl`, `offers.getSignedDownloadUrl`, `offers.getCertificateDownloadUrl`
- Acceptance and close: `opportunities.acceptRequest`, `opportunities.rejectRequest`, `opportunities.requestRevision`, `opportunities.acceptClose`, `opportunities.rejectClose`
- Deal room: `opportunities.listMessages`, `opportunities.listRequestHistory`, `opportunities.getRequestSnapshot`

Not a deal limit, and described above: the commission queries answer `FORBIDDEN` until the contract is signed, and the sales-agent queries need the `sa_owner` role.

## How the catalogue was confirmed

Procedure names are extracted from the client bundles. A name counts as confirmed when a read-only `GET` does not answer `NOT_FOUND`. The extraction also yields minifier noise, which this probe filters out. The catalogue stores only what holds for every account: router, kind and the confirmation method, which is `get-refused` (the `GET` was answered with `METHOD_NOT_SUPPORTED`, so the name is a mutation) or `get-answered` (any other answer except `NOT_FOUND`, so the name exists, and it is a query unless the bundle showed a mutation).

The answer code of the probe is evidence for that one decision and is not stored. `METHOD_NOT_SUPPORTED` is how a `GET` against a mutation is refused. `PRECONDITION_FAILED` is the onboarding state of the probing account on the day of the probe. `FORBIDDEN` is that account's role. `BAD_REQUEST` means the probe input did not validate. None of these describes the procedure itself, so they are not shipped; `saas-kit probe` prints them for the signed-in account as runtime output.

`onboarding.createWorkspace` is not found by the crawl: no page of a signed-in account with a workspace loads the chunk that calls it. It is added by name and confirmed by the same probe, and carries a note in the catalogue.

Regenerate the catalogue with `saas-kit refresh` and the two documentation files with `saas-kit docs`.

## Using the interface safely

- Prefer queries; they cannot write.
- A mutation changes data that other parties on the platform see. The kit only sends one with an explicit `confirm`, to be given after the account holder approved the exact input.
- A legal act needs a second, separate opt-in (next section).
- Keep credentials and the session cookie out of version control.

## Legal acts

Ten procedures bind the account holder legally or financially: signing the platform contract, accepting or rejecting a request or a close, confirming business details, requesting a payout, changing bank details, opening a checkout, sending an offer and creating the workspace.

- `contracts.signWorkspaceContract`
- `opportunities.acceptRequest`, `opportunities.acceptClose`, `opportunities.rejectClose`
- `commission.confirmBusinessDetails`, `commission.requestPayout`, `commission.updateBankDetails`
- `subscriptions.createCheckout`
- `offers.send`
- `onboarding.createWorkspace`

Reason: `confirm=true` is set by whoever calls the tool, and an agent reads text that the platform or a counterparty controls (messages, names, offer text). That text can steer an agent into a legal act in the account holder's name, so `confirm` cannot prove that a person decided. The kit therefore gates these procedures a second time:

- `client.mutate` refuses them unless the caller passes `legalAct: true` besides `confirm: true`.
- The MCP server never passes `legalAct`, and refuses these procedures with `LEGAL_ACT_REFUSED` and the reason. An extra `legalAct` argument sent by an agent is ignored.
- The CLI accepts them only with `--legal-act` besides `--confirm`. `--legal-act` does not replace `--confirm`.

The list is one typed constant, `LEGAL_ACT_PROCEDURES` in `packages/saas-kit/src/legal-acts.ts`. A procedure not on the list is not thereby harmless; the list names the acts that were identified as binding.
