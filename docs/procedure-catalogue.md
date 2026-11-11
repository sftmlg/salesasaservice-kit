# Procedure catalogue

Generated from `docs/procedures.json` (measured 2026-11-10). Do not edit by hand; run `saas-kit docs`.

77 procedures confirmed by a read-only GET that did not answer `NOT_FOUND`.

## activities

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `activities.create` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `activities.createTask` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `activities.delete` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `activities.list` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `activities.update` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `activities.updateTask` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `activities.updateTaskStatus` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## commission

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `commission.confirmBusinessDetails` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `commission.getDashboard` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `commission.getFinancialProfile` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `commission.getHistory` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `commission.listInvoices` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `commission.listPayouts` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `commission.listPositions` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
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
| `inbox.listActive` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `inbox.listFinancial` | GET | `OK` | exists, answers without onboarding |
| `inbox.listProductProposalFailures` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |

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
| `offers.getCertificateDownloadUrl` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `offers.getDownloadUrl` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `offers.getSendRecipients` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `offers.getSignedDownloadUrl` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `offers.listByOpportunity` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `offers.reissueLink` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `offers.revokeLink` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `offers.send` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `offers.startSignedUpload` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## offerTemplates

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `offerTemplates.create` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |

## opportunities

| Procedure | Method | Observed answer to GET | Meaning |
| --- | --- | --- | --- |
| `opportunities.acceptClose` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `opportunities.acceptRequest` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `opportunities.getRequestSnapshot` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `opportunities.getSalesAgentDetail` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `opportunities.listMessages` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `opportunities.listRequestHistory` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `opportunities.rejectClose` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `opportunities.rejectRequest` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `opportunities.requestRevision` | POST | `METHOD_NOT_SUPPORTED` | exists (a GET is refused, so it is a mutation) |
| `opportunities.searchStagingCompanies` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
| `opportunities.searchStagingContacts` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
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
| `subscriptions.getStatus` | GET | `PRECONDITION_FAILED` | exists, gated until onboarding is complete |
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
