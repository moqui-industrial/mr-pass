# IronStone PASS — Public Application Software Suite

PASS is the public-facing component for Modern Rust Moqui. Its Forum uses Mantle MAILBOX lists and
CommunicationEvent posts, with a dedicated public shell, explicit publication, public accounts,
moderation, read markers, protected attachments, and outbound notifications. Its Billing app shows an
organization's invoices to its customers and takes payment from an invoice's pay link; its Supplier app
takes a supplier's quote, purchase order acknowledgement and bill (Purchasing's and Accounting's pages, over Mantle's
SupplierPortalServices and PortalServices). Its Support app is Customer Service's customer pages: help, a customer's
cases and returns, a cancel request for an order, and Feedback, a resolved case's rating from its invitation link (over Mantle's
SupportCaseServices, KnowledgeServices, ReturnPolicyServices, OrderChangeServices and CaseFeedbackServices).

The component has a framework-only static dependency. Local deployments load Mantle. Remote
frontends need only framework, webroot, and PASS; they use one operator-configured Mantle authority
without loading its entity catalog or copying its Party records. BOSS is not a runtime dependency.

The [Forum design](plan/design-forum.md) defines the stages and how an app registers (§13.1); what is built
and verified, and what is deferred, is in [the implementation record](plan/implementation-forum.md).
Operators start with [Deployment](docs/Deployment.md), which also covers the Billing, Supplier, Support and Smithy apps.

Its Shop app ([IronStone Shop](plan/design-shop.md), `screen/Shop.xml`) is a ProductStore's storefront, mounted at
`/shop` or a site's root: the published catalog and search, a cart, a guest or signed-in checkout paying on the store's
hosted payment page, orders, downloads, saved addresses and cards, and prepaid and renewing subscriptions, over Mantle's
Shop services (ShopCatalogServices, ShopCartServices, ShopCheckoutServices, ShopFulfillmentServices,
ShopSubscriptionServices, ShopOperationsServices). Its pages render the site's published theme (the starter is
`theme/starter/`) and work without JavaScript, with Vue islands for the purchase selection and the cart. Its theme and
page editors are [IronStone Commerce](../mr-boss/plan/design-commerce.md)'s; published shops run without BOSS.
[impl-shop](plan/impl-shop.md) records Shop's build; [Deployment](docs/Deployment.md) "Shop app" its setup and jobs.

Its Smithy app ([design](plan/design-smithy.md), `screen/Smithy.xml`) is public git hosting, mounted at `/code` or a
site's root: groups, repositories and their code (files, a file with line anchors, raw, commits, branches, tags, a commit
and a comparison), a repository's issues (the public view of its project's tasks, confidential ones for its Owners and
their reporter, with labels, milestones and a conversation of forum posts written in Markdown), and for an account with a confirmed address creating groups and repositories, their settings and
members, branch rules, webhooks and its own SSH keys and access tokens (Account's Git access), all without JavaScript
(a text's editor is an island over the plain form),
over Mantle's `mantle.smithy` services and the framework's git host. What a visitor may not view is Not Found.
[Deployment](docs/Deployment.md) "Smithy app" has its setup; [the implementation record](plan/implementation-smithy.md)
what is built.

## Starting a community

Install the matching framework and Mantle changes alongside PASS. Provision a disabled site as
an operator, configure its registered hosts and mounts, configure verification mail and media
scanning, then explicitly publish the site and selected categories. Registration starts closed.
An existing mailbox's `isPublic=Y` does not publish it to the internet. Adopted mailboxes must
finish metadata conversion and reconcile failures before publication.

Backend URLs, credentials, sender/template allowlists, SSO flows, callback URLs, storage, and
scanner bindings belong in operator configuration. They are never accepted from public requests.
See [Deployment](docs/Deployment.md) for configuration examples and recovery procedures.

## Development checks

Run from the mr-moqui workspace root with the existing compiler and incremental development build:

```sh
./moq build -- --features moqui-host/image
./moq test mr-pass mr-mantle mr-boss --nobuild --spec Forum,ForumAccess,Media,PublicIdentity,SsoHandoff,Transport,PassAuthority,Outbox,Mailboxes,InboxMailboxes,Participation,Moderation,Conversations,InboundMail,Entitlements,Subscriptions,Integrations,Operations,Import,CommsModeration,Portals,AccountingPortals,SupplierPages,SupplierPortal,SupportAccess,CaseFeedback,SupportPortal,ShopAccess,ShopThemes,ShopCatalog,ShopCart,ShopCheckout,ShopAccount,ShopSubscriptions,ShopReviews,ShopPreview,ShopFeeds,StoreFeeds,ShopOperations,StoreAdoption,StoreCheckout,StoreFulfillment,ShopCustomer,CartRecovery,ThemeReleases,ThemeAuthoring,Smithy,SmithyAccess --db snapshot
# Billing and Supplier in the browser, at 390 px and on the desktop; Shop's golden-path checkout walk
./moq test-client mr-pass --nobuild --serve --spec PortalHttp,ShopCheckoutWalk
./moq run --nobuild lint --screens
# the acceptance suite (ForumHttp, SupplierPortalHttp, SupportFeedbackHttp, SupportPagesHttp, SupportIsolation, ShopMount, ShopThemeRelease, ShopHttp, ShopRemoteHttp, ShopCartHttp, ShopCartRemoteHttp, ShopCheckoutHttp, ShopAccessibilityHttp, ShopPaymentScenarios, ShopOrderScenarios, ShopSubscriptionScenarios, ShopOperationsScenarios, SmithyWalk, Scale, RemoteHttp), only when asked or after adding or changing one of its tests
./moq accept mr-pass
```

JavaScript service and browser specs run through Moqui, without Node as a test dependency. The specs in `test/` are the
regression suite, grouped in subdirectories named for the `screen/` directory of the area they cover (`Forum`,
`Account`, ...). `test/acceptance/` holds the acceptance suite: the forum's, the Supplier app's and the Support app's browser scenarios (`ForumHttp`,
`SupplierPortalHttp`, `SupportFeedbackHttp` and `SupportPagesHttp`, with their fixtures `SupplierPortalFixtures` and `SupportFixtures`), the
Support app's isolation between customers (`SupportIsolation`), Shop's mount at a site's root (`ShopMount`), its theme release (`ShopThemeRelease`), its catalog walks over the demo Shop
sites (`ShopHttp` and `ShopRemoteHttp`, with `ShopFixtures`, and `ShopRemoteFixtures` for the remote frontend), its cart walks
(`ShopCartHttp` in the browser, `ShopCartRemoteHttp` with plain requests, locally or through a remote frontend), Commerce's
store operations over the Shop orders (`ShopOrdersInCommerce`, after `ShopOrderScenarios`; it needs mr-boss) and its
subscription operations over a Shop subscription (`ShopSubscriptionsInCommerce`; it needs mr-boss), Shop's adoption and
operations (`ShopOperationsScenarios`: a legacy store's adoption preview and approved proposal, a withdrawn mount with an
attempt reconciled, a remote frontend's outage), Shop's checkout in the browser (`ShopCheckoutHttp`) and its
accessibility and device checks (`ShopAccessibilityHttp`: a keyboard-only checkout at 390 px with announced totals and a
labelled, focused refusal, reduced motion, the account pages at 390 px), Smithy's golden-path walk (`SmithyWalk`, with
`SmithyWalkFixtures`: browsing, then a signed-in account creating a repository, and the pages that write at 390 px), its payment, order and subscription scenarios
on the server (`ShopPaymentScenarios`, `ShopOrderScenarios`, `ShopSubscriptionScenarios`; design-shop §18.1 maps each
scenario to its test in impl-shop §8), the large
fixture (`Scale`, with `-D pass_scale_test=true`) and the remote frontend (`RemoteHttp` and `RemoteFixtures`, which use
two independent runtimes; see the deployment guide). The two suites are described in `docs/Build-Test.md` (The two
suites) in the mr-moqui repository.
Test-only configuration, scanner, and captured email fixtures must not be used as production
provider configuration.

## License and Contributing

[CC0 1.0 Universal with a Grant of Patent License](LICENSE.md). To contribute code, sign
[AUTHORS.md](AUTHORS.md) in a commit from the account that submits the pull request; its Contributing
section has the details.
