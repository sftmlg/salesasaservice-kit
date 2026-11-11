# Procedure catalogue

Generated from `packages/saas-kit/data/procedures.json` (measured 2026-11-11). Do not edit by hand; run `saas-kit docs`.

97 procedures confirmed by a read-only GET that did not answer `NOT_FOUND`. The catalogue holds only what is true for every account; what a GET answers for one account on one day is runtime output of `saas-kit probe`, explained under "How the catalogue was confirmed" in [api-reference.md](api-reference.md).

## activities

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `activities.create` | POST | a GET is refused (405), so it is a mutation |  |
| `activities.createTask` | POST | a GET is refused (405), so it is a mutation |  |
| `activities.delete` | POST | a GET is refused (405), so it is a mutation |  |
| `activities.list` | GET | a GET is answered (anything but not found) |  |
| `activities.update` | POST | a GET is refused (405), so it is a mutation |  |
| `activities.updateTask` | POST | a GET is refused (405), so it is a mutation |  |
| `activities.updateTaskStatus` | POST | a GET is refused (405), so it is a mutation |  |

## commission

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `commission.confirmBusinessDetails` | POST | a GET is refused (405), so it is a mutation |  |
| `commission.getDashboard` | GET | a GET is answered (anything but not found) |  |
| `commission.getFinancialProfile` | GET | a GET is answered (anything but not found) |  |
| `commission.getHistory` | GET | a GET is answered (anything but not found) |  |
| `commission.listInvoices` | GET | a GET is answered (anything but not found) |  |
| `commission.listPayouts` | GET | a GET is answered (anything but not found) |  |
| `commission.listPositions` | GET | a GET is answered (anything but not found) |  |
| `commission.quotePayout` | POST | a GET is refused (405), so it is a mutation |  |
| `commission.requestPayout` | POST | a GET is refused (405), so it is a mutation |  |
| `commission.requestTaxProfileOverride` | POST | a GET is refused (405), so it is a mutation |  |
| `commission.retryDocument` | POST | a GET is refused (405), so it is a mutation |  |
| `commission.updateBankDetails` | POST | a GET is refused (405), so it is a mutation |  |

## contracts

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `contracts.signWorkspaceContract` | POST | a GET is refused (405), so it is a mutation |  |

## cookieConsents

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `cookieConsents.record` | POST | a GET is refused (405), so it is a mutation |  |

## inbox

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `inbox.acknowledge` | POST | a GET is refused (405), so it is a mutation |  |
| `inbox.acknowledgeFinancial` | POST | a GET is refused (405), so it is a mutation |  |
| `inbox.acknowledgeProductProposalFailure` | POST | a GET is refused (405), so it is a mutation |  |
| `inbox.listActive` | GET | a GET is answered (anything but not found) |  |
| `inbox.listFinancial` | GET | a GET is answered (anything but not found) |  |
| `inbox.listProductProposalFailures` | GET | a GET is answered (anything but not found) |  |

## listingDefaults

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `listingDefaults.save` | POST | a GET is refused (405), so it is a mutation |  |

## listings

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `listings.commit` | POST | a GET is refused (405), so it is a mutation |  |
| `listings.create` | POST | a GET is refused (405), so it is a mutation |  |
| `listings.deleteDraft` | POST | a GET is refused (405), so it is a mutation |  |
| `listings.publish` | POST | a GET is refused (405), so it is a mutation |  |
| `listings.unpublish` | POST | a GET is refused (405), so it is a mutation |  |
| `listings.update` | POST | a GET is refused (405), so it is a mutation |  |

## offers

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `offers.completeSignedUpload` | POST | a GET is refused (405), so it is a mutation |  |
| `offers.getCertificateDownloadUrl` | GET | a GET is answered (anything but not found) |  |
| `offers.getDownloadUrl` | GET | a GET is answered (anything but not found) |  |
| `offers.getSendRecipients` | GET | a GET is answered (anything but not found) |  |
| `offers.getSignedDownloadUrl` | GET | a GET is answered (anything but not found) |  |
| `offers.listByOpportunity` | GET | a GET is answered (anything but not found) |  |
| `offers.reissueLink` | POST | a GET is refused (405), so it is a mutation |  |
| `offers.revokeLink` | POST | a GET is refused (405), so it is a mutation |  |
| `offers.send` | POST | a GET is refused (405), so it is a mutation |  |
| `offers.startSignedUpload` | POST | a GET is refused (405), so it is a mutation |  |

## offerTemplates

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `offerTemplates.create` | POST | a GET is refused (405), so it is a mutation |  |

## onboarding

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `onboarding.createWorkspace` | POST | a GET is refused (405), so it is a mutation | Discovery cannot see it before a page loads the chunk that calls it (the onboarding screen of an account without a workspace). It is added by name and confirmed by the GET probe. |

## opportunities

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `opportunities.acceptClose` | POST | a GET is refused (405), so it is a mutation |  |
| `opportunities.acceptRequest` | POST | a GET is refused (405), so it is a mutation |  |
| `opportunities.getRequestSnapshot` | GET | a GET is answered (anything but not found) |  |
| `opportunities.getSalesAgentDetail` | GET | a GET is answered (anything but not found) |  |
| `opportunities.listMessages` | GET | a GET is answered (anything but not found) |  |
| `opportunities.listRequestHistory` | GET | a GET is answered (anything but not found) |  |
| `opportunities.rejectClose` | POST | a GET is refused (405), so it is a mutation |  |
| `opportunities.rejectRequest` | POST | a GET is refused (405), so it is a mutation |  |
| `opportunities.requestRevision` | POST | a GET is refused (405), so it is a mutation |  |
| `opportunities.searchStagingCompanies` | GET | a GET is answered (anything but not found) |  |
| `opportunities.searchStagingContacts` | GET | a GET is answered (anything but not found) |  |
| `opportunities.updateStaging` | POST | a GET is refused (405), so it is a mutation |  |

## productProposals

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `productProposals.accept` | POST | a GET is refused (405), so it is a mutation |  |
| `productProposals.delete` | POST | a GET is refused (405), so it is a mutation |  |

## products

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `products.completeImageUpload` | POST | a GET is refused (405), so it is a mutation |  |
| `products.create` | POST | a GET is refused (405), so it is a mutation |  |
| `products.delete` | POST | a GET is refused (405), so it is a mutation |  |
| `products.extractFromText` | POST | a GET is refused (405), so it is a mutation |  |
| `products.extractPricing` | POST | a GET is refused (405), so it is a mutation |  |
| `products.generateShortDescription` | POST | a GET is refused (405), so it is a mutation |  |
| `products.inspectWebsite` | POST | a GET is refused (405), so it is a mutation |  |
| `products.startImageUpload` | POST | a GET is refused (405), so it is a mutation |  |
| `products.suggestClassification` | POST | a GET is refused (405), so it is a mutation |  |
| `products.update` | POST | a GET is refused (405), so it is a mutation |  |

## profile

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `profile.cancelLogoUpload` | POST | a GET is refused (405), so it is a mutation |  |
| `profile.completeLogoUpload` | POST | a GET is refused (405), so it is a mutation |  |
| `profile.deleteLogo` | POST | a GET is refused (405), so it is a mutation |  |
| `profile.startLogoUpload` | POST | a GET is refused (405), so it is a mutation |  |
| `profile.updateAddress` | POST | a GET is refused (405), so it is a mutation |  |
| `profile.updateInfo` | POST | a GET is refused (405), so it is a mutation |  |
| `profile.updateUnlimitedPartners` | POST | a GET is refused (405), so it is a mutation |  |

## questionCatalogs

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `questionCatalogs.activateCatalog` | POST | a GET is refused (405), so it is a mutation |  |
| `questionCatalogs.generateCatalog` | POST | a GET is refused (405), so it is a mutation |  |
| `questionCatalogs.getCatalogForProduct` | GET | a GET is answered (anything but not found) |  |
| `questionCatalogs.getGenerationBudget` | GET | a GET is answered (anything but not found) |  |
| `questionCatalogs.invalidateQualifications` | POST | a GET is refused (405), so it is a mutation |  |
| `questionCatalogs.regenerateQuestion` | POST | a GET is refused (405), so it is a mutation |  |
| `questionCatalogs.replyToInterview` | POST | a GET is refused (405), so it is a mutation |  |
| `questionCatalogs.startAttempt` | POST | a GET is refused (405), so it is a mutation |  |
| `questionCatalogs.startInterview` | POST | a GET is refused (405), so it is a mutation |  |
| `questionCatalogs.submitAttempt` | POST | a GET is refused (405), so it is a mutation |  |

## salesAgentWaitlistEntries

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `salesAgentWaitlistEntries.createEntry` | POST | a GET is refused (405), so it is a mutation |  |

## subscriptions

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `subscriptions.cancelAtPeriodEnd` | POST | a GET is refused (405), so it is a mutation |  |
| `subscriptions.createCheckout` | POST | a GET is refused (405), so it is a mutation |  |
| `subscriptions.createPortalSession` | POST | a GET is refused (405), so it is a mutation |  |
| `subscriptions.getStatus` | GET | a GET is answered (anything but not found) |  |
| `subscriptions.reactivate` | POST | a GET is refused (405), so it is a mutation |  |

## verification

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `verification.cancelIdentityDocumentVerification` | POST | a GET is refused (405), so it is a mutation |  |
| `verification.resumeIdentityDocumentVerification` | POST | a GET is refused (405), so it is a mutation |  |
| `verification.startWorkspaceVerification` | POST | a GET is refused (405), so it is a mutation |  |

## workspaceUsers

| Procedure | Method | Confirmed by | Note |
| --- | --- | --- | --- |
| `workspaceUsers.remove` | POST | a GET is refused (405), so it is a mutation |  |
