# Procedure catalogue

Generated from `packages/saas-kit/data/procedures.json` (measured 2026-11-11). Do not edit by hand; run `saas-kit docs`.

78 procedures confirmed by a read-only GET that did not answer `NOT_FOUND`.

## activities

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `activities.create` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `activities.createTask` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `activities.delete` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `activities.list` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `activities.update` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `activities.updateTask` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `activities.updateTaskStatus` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## commission

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `commission.confirmBusinessDetails` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `commission.getDashboard` | GET | `FORBIDDEN` | exists, refused for the probing account (role or workspace permission) |
| `commission.getFinancialProfile` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `commission.getHistory` | GET | `FORBIDDEN` | exists, refused for the probing account (role or workspace permission) |
| `commission.listInvoices` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `commission.listPayouts` | GET | `FORBIDDEN` | exists, refused for the probing account (role or workspace permission) |
| `commission.listPositions` | GET | `FORBIDDEN` | exists, refused for the probing account (role or workspace permission) |
| `commission.quotePayout` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `commission.requestPayout` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `commission.requestTaxProfileOverride` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `commission.retryDocument` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `commission.updateBankDetails` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## contracts

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `contracts.signWorkspaceContract` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## cookieConsents

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `cookieConsents.record` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## inbox

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `inbox.acknowledge` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `inbox.acknowledgeFinancial` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `inbox.acknowledgeProductProposalFailure` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `inbox.listActive` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `inbox.listFinancial` | GET | `OK` | exists, answers without onboarding |
| `inbox.listProductProposalFailures` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |

## listingDefaults

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `listingDefaults.save` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## listings

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `listings.commit` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `listings.deleteDraft` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `listings.publish` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `listings.unpublish` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `listings.update` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## offers

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `offers.completeSignedUpload` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `offers.getCertificateDownloadUrl` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `offers.getDownloadUrl` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `offers.getSendRecipients` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `offers.getSignedDownloadUrl` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `offers.listByOpportunity` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `offers.reissueLink` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `offers.revokeLink` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `offers.send` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `offers.startSignedUpload` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## offerTemplates

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `offerTemplates.create` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## onboarding

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `onboarding.createWorkspace` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## opportunities

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `opportunities.acceptClose` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `opportunities.acceptRequest` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `opportunities.getRequestSnapshot` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `opportunities.getSalesAgentDetail` | GET | `FORBIDDEN` | exists, refused for the probing account (role or workspace permission) |
| `opportunities.listMessages` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `opportunities.listRequestHistory` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `opportunities.rejectClose` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `opportunities.rejectRequest` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `opportunities.requestRevision` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `opportunities.searchStagingCompanies` | GET | `FORBIDDEN` | exists, refused for the probing account (role or workspace permission) |
| `opportunities.searchStagingContacts` | GET | `FORBIDDEN` | exists, refused for the probing account (role or workspace permission) |
| `opportunities.updateStaging` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## productProposals

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `productProposals.delete` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## products

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `products.delete` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## profile

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `profile.cancelLogoUpload` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `profile.completeLogoUpload` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `profile.deleteLogo` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `profile.startLogoUpload` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `profile.updateAddress` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `profile.updateInfo` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `profile.updateUnlimitedPartners` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## questionCatalogs

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `questionCatalogs.startAttempt` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `questionCatalogs.submitAttempt` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## salesAgentWaitlistEntries

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `salesAgentWaitlistEntries.createEntry` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## subscriptions

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `subscriptions.cancelAtPeriodEnd` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `subscriptions.createCheckout` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `subscriptions.createPortalSession` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `subscriptions.getStatus` | GET | `BAD_REQUEST` | exists, rejects the null input (needs a real input) |
| `subscriptions.reactivate` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## verification

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `verification.cancelIdentityDocumentVerification` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `verification.resumeIdentityDocumentVerification` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `verification.startWorkspaceVerification` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## workspaceUsers

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `workspaceUsers.remove` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
