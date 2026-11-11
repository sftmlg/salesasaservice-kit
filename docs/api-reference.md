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

For an account that has not finished onboarding, workspace procedures answer `PRECONDITION_FAILED` ("Onboarding state does not allow this operation") until it has completed: company profile with legal details, verification (the platform's own profile page says "Mit USt-IdNr. läuft die Verifizierung automatisch, sonst per Ausweisdokument"), and the platform contract including a declaration of signing authority. Most of these steps are legal acts of the account holder and cannot be done by the kit. Once the account has a business-partner workspace the gated queries answer with their own result or error (`BAD_REQUEST` when the input does not validate, `FORBIDDEN` for a missing role) instead. Two mutations belong to this flow: `onboarding.createWorkspace` creates the workspace, and `verification.startWorkspaceVerification` (void input) starts its verification. Neither is on the MCP allowlist, so over MCP both are refused, and the library and the CLI send them only with `legalAct` besides `confirm` (see [Mutation policy](#mutation-policy)).

### Order for a business partner

1. `onboarding.createWorkspace` with type `business_partner`.
2. `profile.updateInfo` (company data) and `profile.updateAddress`. Both are legal statements and not on the MCP allowlist: the CLI needs `--confirm --legal-act`.
3. Verification: `verification.startWorkspaceVerification`. The platform's own profile page says "Mit USt-IdNr. läuft die Verifizierung automatisch, sonst per Ausweisdokument".
4. The platform contract (`contracts.signWorkspaceContract`), which includes the declaration of signing authority.
5. Listings. They can be placed before the contract is signed and then show as "coming soon".

After verification, the workspace queries below answer with their own results. Before the platform contract is signed, the commission dashboard, history, payouts and positions answer `FORBIDDEN` (`not_authorized`); the cause was not isolated further.

## Input schemas

The platform does not publish input schemas. A schema is documented here only after it was observed against the live platform, either as a call with that input that succeeded or, where stated, from the validation errors of an invalid input; everything else is left open. Zod's validation errors name missing fields, which is how most shapes below were found.

### Mutations

The four onboarding mutations below were called against the live platform with exactly the input documented here, and each returned success. The shapes are taken from those calls, not from a list of field names.

| Procedure                                 | Input                                                                                                       | Answer                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `onboarding.createWorkspace`              | `type` (`business_partner` or `sales_agent`), `legalName`, `website`, `websiteConfirmed`, `proposeProducts` | success: a workspace id; the creator becomes the workspace owner (`bp_owner`)                                |
| `verification.startWorkspaceVerification` | void: body `{}`                                                                                             | success: a verification status; the profile page text says the verification runs automatically with a VAT id |
| `profile.updateAddress`                   | `street`, `postalCode`, `city`, `country` (ISO country code, for example `AT`)                              | `{"success":true}`; sending the current values changes nothing                                               |
| `profile.updateInfo`                      | see below                                                                                                   | `{"success":true}`                                                                                           |

`profile.updateInfo` fields (observed live): `companiesRegisterCourt`, `companiesRegisterNumber`, `companiesRegisterStatus` (`registered` or `not_registered`), `contactEmail`, `contactPhone`, `displayName`, `formationStatus` (`established` or `in_formation`), `gisaNumber`, `hasNaturalPersonUnlimitedPartner` (boolean or `null`), `inLiquidation` (boolean or `null`), `legalForm` (`gmbh`, `flexkapg`, `ag`, `og`, `kg`, `gmbh_co_kg`, `sole_proprietor`, `gesbr` or `other`), `legalName`, `otherLegalForm`, `proprietorName`, `vatId`, `website`, `websiteConfirmed`. Text fields that do not apply take empty strings; `null` is rejected.

### Product and listing mutations

These shapes were measured from the validation errors that invalid input produces. No call with a valid input was sent, so nothing was written, and the answers of a successful call are not documented. The errors name fields and enumerated values; which fields are optional was not recorded. `products.create`, `products.update` and `listings.create` are refused over MCP (see [Everything else](#everything-else)); `listings.update` and the two below it are on the [allowlist](#mcp-allowlist).

`products.create` and `products.update` take the same fields; `products.update` adds `id`:

| Field                                                     | Value                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                                                    | `goods` or `service`                                                                                                                                                                                                                                                                                                                                    |
| `approvalMode`                                            | `manual` or `automatic`                                                                                                                                                                                                                                                                                                                                 |
| `category`                                                | `software_it`, `consulting_professional_services`, `marketing_sales`, `people_recruiting`, `finance_legal`, `operations_production`, `logistics_mobility`, `education_training`, `energy_sustainability`, `other`, or `""`                                                                                                                              |
| `title`, `subtitle`, `shortDescription`, `description`    | strings                                                                                                                                                                                                                                                                                                                                                 |
| `offerTemplateId`                                         | uuid                                                                                                                                                                                                                                                                                                                                                    |
| `requirements`                                            | array of objects with `type` `"question_catalog"`                                                                                                                                                                                                                                                                                                       |
| `targetIndustries`                                        | array of `all_b2b_industries`, `automotive_mobility`, `construction_real_estate`, `education`, `energy_utilities`, `financial_services_insurance`, `healthcare_life_sciences`, `retail_ecommerce`, `hospitality_tourism`, `manufacturing`, `public_nonprofit`, `professional_services`, `technology_telecommunications`, `transport_logistics`, `other` |
| `tags`                                                    | array                                                                                                                                                                                                                                                                                                                                                   |
| `unit`                                                    | `piece`, `hour`, `minute`, `day`, `user`, `license`, or `""`                                                                                                                                                                                                                                                                                            |
| `blockSize`, `pricePerBlockEuros`, `minQuantity`, `terms` | strings                                                                                                                                                                                                                                                                                                                                                 |
| `billingPeriod`                                           | `one_time`, `per_month`, or `""`                                                                                                                                                                                                                                                                                                                        |
| `imageIds`                                                | array                                                                                                                                                                                                                                                                                                                                                   |

`listings.create` and `listings.update` take the same fields; `listings.update` adds `id`:

| Field                                         | Value                |
| --------------------------------------------- | -------------------- |
| `productId`                                   | uuid                 |
| `titleOverride`, `descriptionOverride`        | string or `null`     |
| `targetIndustriesOverride`                    | array or `null`      |
| `region`, `targetCustomer`, `engagementTerms` | strings              |
| `commissionMode`                              | `percent` or `fixed` |
| `commissionValue`                             | string               |
| `commissionTiers`                             | array                |

`listingDefaults.save` takes `region`, `targetCustomer`, `engagementTerms`, `commissionMode` and `commissionValue`, with the same value types as the listing fields.

`offerTemplates.create` takes `name` (string); further fields are unknown.

The helper procedures `products.extractFromText`, `products.extractPricing`, `products.generateShortDescription`, `products.inspectWebsite`, `products.suggestClassification`, `products.startImageUpload`, `products.completeImageUpload` and `questionCatalogs.getCatalogForProduct` have no measured input; they are catalogued by name only (see below).

### Queries

Queries without input send `input={}` (see the request envelope). The workspace id the queries need is `session.activeWorkspaceId` from `GET /api/auth/get-session` (`saas-kit status` prints it).

| Procedure                                                                                                                                                                                   | Input                                                                                                     | Answer                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subscriptions.getStatus`                                                                                                                                                                   | void                                                                                                      | `access` (`status`, `workspaceType`), `canCancelAtPeriodEnd`, `canManageBilling`, `canOpenBillingPortal`, `offeredPackage`, `pendingOperation`                                                                                                                                |
| `commission.getFinancialProfile`                                                                                                                                                            | void                                                                                                      | `businessIdentity` (`legalName`, `street`, `postalCode`, `city`, `country`, `vatId`, `companiesRegisterNumber`, `gisaNumber`), `profile` (the same identity, plus `classification` and `source`), `taxOverride`, `bank`, `businessConfirmationId`, `selfBillingClauseVersion` |
| `commission.listInvoices`                                                                                                                                                                   | object, `{}` accepted                                                                                     | a page: `items` and `nextCursor`                                                                                                                                                                                                                                              |
| `inbox.listFinancial`                                                                                                                                                                       | object, `{}` accepted                                                                                     | a list                                                                                                                                                                                                                                                                        |
| `inbox.listActive`                                                                                                                                                                          | `workspaceId`                                                                                             | a list                                                                                                                                                                                                                                                                        |
| `inbox.listProductProposalFailures`                                                                                                                                                         | `workspaceId`                                                                                             | a list                                                                                                                                                                                                                                                                        |
| `activities.list`                                                                                                                                                                           | `context`: `{"kind":"crm"}`, `{"kind":"listing","listingId"}` or `{"kind":"opportunity","opportunityId"}` | a list for `crm`                                                                                                                                                                                                                                                              |
| `opportunities.listMessages`, `opportunities.listRequestHistory`, `opportunities.getRequestSnapshot`, `offers.listByOpportunity`, `offers.getSendRecipients`, `offers.getSignedDownloadUrl` | `opportunityId`                                                                                           | `listMessages` and `listByOpportunity` answer `NOT_FOUND` ("Deal room not found", "Offer not found") for an unknown id; the answer for a real deal room is not documented                                                                                                     |
| `offers.getDownloadUrl`                                                                                                                                                                     | `offerId`, `opportunityId`                                                                                | not observed with a real offer                                                                                                                                                                                                                                                |
| `offers.getCertificateDownloadUrl`                                                                                                                                                          | `acceptanceId`, `opportunityId`                                                                           | not observed with a real acceptance                                                                                                                                                                                                                                           |
| `commission.getDashboard`, `commission.getHistory`, `commission.listPayouts`, `commission.listPositions`                                                                                    | not determined                                                                                            | `FORBIDDEN` `not_authorized` before the contract is signed                                                                                                                                                                                                                    |
| `opportunities.getSalesAgentDetail`, `opportunities.searchStagingCompanies`, `opportunities.searchStagingContacts`                                                                          | not determined                                                                                            | `FORBIDDEN`, "Requires one of: sa_owner" (sales-agent role only)                                                                                                                                                                                                              |

## Known limits

These procedures need an existing deal (an opportunity with a deal room, an offer or an acceptance). Without a real deal an input cannot be observed: an unknown id only answers `NOT_FOUND`, and sending a mutation would act on a real counterparty. They are catalogued by name and kind and their inputs stay open; this is a limit of what can be exercised, not a gap in the reference.

- Offers: `offers.send`, `offers.reissueLink`, `offers.revokeLink`, `offers.startSignedUpload`, `offers.completeSignedUpload`, `offers.listByOpportunity`, `offers.getSendRecipients`, `offers.getDownloadUrl`, `offers.getSignedDownloadUrl`, `offers.getCertificateDownloadUrl`
- Acceptance and close: `opportunities.acceptRequest`, `opportunities.rejectRequest`, `opportunities.requestRevision`, `opportunities.acceptClose`, `opportunities.rejectClose`
- Deal room: `opportunities.listMessages`, `opportunities.listRequestHistory`, `opportunities.getRequestSnapshot`

Not a deal limit, and described above: the commission queries answer `FORBIDDEN` until the contract is signed, and the sales-agent queries need the `sa_owner` role.

## How the catalogue was confirmed

Procedure names are extracted from the client bundles. A name counts as confirmed when a read-only `GET` does not answer `NOT_FOUND`. The extraction also yields minifier noise, which this probe filters out. The catalogue stores only what holds for every account: router, kind and the confirmation method, which is `get-refused` (the `GET` was answered with `METHOD_NOT_SUPPORTED`, so the name is a mutation) or `get-answered` (any other answer except `NOT_FOUND`, so the name exists, and it is a query unless the bundle showed a mutation).

The answer code of the probe is evidence for that one decision and is not stored. `METHOD_NOT_SUPPORTED` is how a `GET` against a mutation is refused. `PRECONDITION_FAILED` is the onboarding state of the probing account on the day of the probe. `FORBIDDEN` is that account's role. `BAD_REQUEST` means the probe input did not validate. None of these describes the procedure itself, so they are not shipped; `saas-kit probe` prints them for the signed-in account as runtime output.

A third kind, `unprobed`, marks a name that a page of the app references but that no probe has answered yet. Its kind (query or mutation) is inferred from the name, not measured, and it is classified as unconfirmed everywhere the catalogue is rendered. `saas-kit refresh` replaces it with `get-refused` or `get-answered` as soon as a signed-in run probes the name. The bundled catalogue currently holds none: the twelve product and listing names were probed by a signed-in refresh, eleven are mutations (the GET was refused) and `questionCatalogs.getCatalogForProduct` is a query. The default crawl of `refresh` and `discover` starts at `/de` and `/de/business-partner/products-services`: the latter is the only page that references the product procedures, and the crawl follows the links it finds from there.

`onboarding.createWorkspace` is not found by the crawl: no page of a signed-in account with a workspace loads the chunk that calls it. It is added by name and confirmed by the same probe, and carries a note in the catalogue.

Regenerate the catalogue with `saas-kit refresh` and the two documentation files with `saas-kit docs`.

## Using the interface safely

- Prefer queries; they cannot write.
- A mutation changes data that other parties on the platform see. The kit only sends one with an explicit `confirm`, to be given after the account holder approved the exact input.
- Over MCP only the allowlisted mutations are accepted; every other mutation needs a second, separate opt-in (next section).
- Keep credentials and the session cookie out of version control.

## Mutation policy

`confirm=true` is set by whoever calls the tool, and an agent reads text that the platform or a counterparty controls (messages, names, offer text). That text can steer an agent into a write in the account holder's name, so `confirm` cannot prove that a person decided. The kit therefore accepts over MCP only an allowlist of reviewed, reversible working mutations, and treats every other mutation as needing a second opt-in.

### MCP allowlist

These 17 mutations are accepted over MCP, each with `confirm=true`. Each one creates or edits a working record of the account (logo, listing defaults, activities, tasks, inbox read marks, companies, contacts), and a further edit corrects it. None deletes anything, and none publishes, sends, signs, pays or consents:

- `profile.startLogoUpload`, `profile.completeLogoUpload`, `profile.cancelLogoUpload`
- `listings.update`, `listingDefaults.save`
- `offerTemplates.create`
- `activities.create`, `activities.update`
- `activities.createTask`, `activities.updateTask`, `activities.updateTaskStatus`
- `inbox.acknowledge`, `inbox.acknowledgeProductProposalFailure`
- `companies.create`, `companies.update`
- `contacts.create`, `contacts.update`

The list is one typed constant, `MCP_ALLOWED_MUTATIONS` in `packages/saas-kit/src/legal-acts.ts`, and a test fails if this section differs from it. Names are matched exactly: a case variant or a name with whitespace is not on the list. The companies and contacts mutations are allowlisted by name but are not in the bundled catalogue.

### Everything else

Every other mutation, including an unknown name, is refused over MCP with `LEGAL_ACT_REFUSED` and a message that names the reason. That covers the account's legal statements (`profile.updateInfo`, `profile.updateAddress`, `profile.updateUnlimitedPartners`), everything that publishes (`listings.publish`, `listings.unpublish`, `listings.commit`), deletes (`listings.deleteDraft`, `products.delete`, `productProposals.delete`, `activities.delete`, `profile.deleteLogo`), acknowledges a financial item (`inbox.acknowledgeFinancial`), accepts or rejects (`opportunities.*`), sends (`offers.*`), signs (`contracts.*`), pays or changes bank details (`commission.*`), subscribes (`subscriptions.*`), verifies or onboards (`verification.*`, `onboarding.*`), consents (`cookieConsents.record`), submits (`questionCatalogs.*`, `salesAgentWaitlistEntries.createEntry`) and removes users (`workspaceUsers.remove`), and any catalogued mutation not listed above.

The product procedures follow the same rule, per name:

- `products.create`, `products.update`, `listings.create` and `productProposals.accept` put or keep an entry in front of sales agents (a listing shows as "coming soon" before the contract is signed), so they are statements in the account holder's name. Editing a listing that exists is on the allowlist, adding one is not.
- `products.inspectWebsite` makes the platform fetch a web address that the caller names, so an agent steered by platform text could direct it; it is refused.
- `products.extractFromText`, `products.extractPricing`, `products.generateShortDescription` and `products.suggestClassification` probably only compute a result from the text they are given, but whether they also store it, bill for it or send the text to a third party was not observed, and the catalogue does not even confirm that they are mutations. They are refused until that is observed.
- `products.startImageUpload` and `products.completeImageUpload` stage a file like the logo upload does, but no `cancel` counterpart is catalogued, so a staged upload could not be undone by a further edit. They are refused.

- `profile.updateInfo`, `profile.updateAddress` and `profile.updateUnlimitedPartners` state the company's legal data: legal name, legal form, register number, registered address, unlimited partners and the VAT id. The platform uses them for its self-billing, and a later edit does not undo invoices already issued, so a steered agent must not be able to change them. The registered address counts because the supplier's address is a mandatory invoice particular.
- `client.mutate` refuses them unless the caller passes `legalAct: true` besides `confirm: true`.
- The MCP server never passes `legalAct`, and an extra `legalAct` argument sent by an agent is ignored.
- The CLI accepts them only with `--legal-act` besides `--confirm`. `--legal-act` does not replace `--confirm`.
- The refused set is the complement of the allowlist; there is no second list to keep in step.
