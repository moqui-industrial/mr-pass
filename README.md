# IronStone PASS — Public Application Software Suite

PASS is the public-facing component for Modern Rust Moqui. Its Forum uses Mantle MAILBOX lists and
CommunicationEvent posts, with a dedicated public shell, explicit publication, public accounts,
moderation, read markers, protected attachments, and outbound notifications. Its Billing app shows an
organization's invoices to its customers and takes payment from an invoice's pay link; its Supplier app
takes a supplier's quote, purchase order acknowledgement and bill (Purchasing's and Accounting's pages, over Mantle's
SupplierPortalServices and PortalServices). Its Support app is Customer Service's customer pages, starting with Feedback, a
resolved case's rating from its invitation link (over Mantle's CaseFeedbackServices).

The component has a framework-only static dependency. Local deployments load Mantle. Remote
frontends need only framework, webroot, and PASS; they use one operator-configured Mantle authority
without loading its entity catalog or copying its Party records. BOSS is not a runtime dependency.

The [Forum design](plan/design-forum.md) defines the stages and how an app registers (§13.1); what is built
and verified, and what is deferred, is in [the implementation record](plan/implementation-forum.md).
Operators start with [Deployment](docs/Deployment.md), which also covers the Billing, Supplier and Support apps.

[IronStone Shop](plan/design-shop.md) designs the public storefront, checkout, customer purchases
and subscriptions. Its theme/page editors are defined in
[IronStone Commerce](../mr-boss/plan/design-commerce.md); published shops run without BOSS.
[impl-shop](plan/impl-shop.md) plans Shop's build, in one order with Commerce's.

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
./moq test mr-pass mr-mantle mr-boss --nobuild --spec Forum,ForumAccess,Media,PublicIdentity,SsoHandoff,Transport,PassAuthority,Outbox,Mailboxes,InboxMailboxes,Participation,Moderation,Conversations,InboundMail,Entitlements,Subscriptions,Integrations,Operations,Import,CommsModeration,Portals,AccountingPortals,SupplierPages,SupplierPortal,SupportAccess,CaseFeedback --db snapshot
# Billing and Supplier in the browser, at 390 px and on the desktop
./moq test-client mr-pass --nobuild --serve --spec PortalHttp
./moq run --nobuild lint --screens
# the acceptance suite (ForumHttp, SupplierPortalHttp, SupportFeedbackHttp, Scale, RemoteHttp), only when asked or after adding or changing one of its tests
./moq accept mr-pass
```

JavaScript service and browser specs run through Moqui, without Node as a test dependency. The specs in `test/` are the
regression suite, grouped in subdirectories named for the `screen/` directory of the area they cover (`Forum`,
`Account`, ...). `acceptance/` holds the acceptance suite: the forum's, the Supplier app's and the Support app's browser scenarios (`ForumHttp`,
`SupplierPortalHttp` and `SupportFeedbackHttp`, with their fixtures `SupplierPortalFixtures` and `SupportFixtures`), the large
fixture (`Scale`, with `-D pass_scale_test=true`) and the remote frontend (`RemoteHttp` and `RemoteFixtures`, which use
two independent runtimes; see the deployment guide). The two suites are described in `docs/Build-Test.md` (The two
suites) in the mr-moqui repository.
Test-only configuration, scanner, and captured email fixtures must not be used as production
provider configuration.

## License

[CC0 1.0 Universal with an additional Grant of Patent License](LICENSE.md).
