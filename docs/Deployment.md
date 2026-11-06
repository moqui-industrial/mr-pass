# PASS Forum deployment

## Components and authority

Use matching framework, Mantle, and PASS source changes. Use a package with image support for
thumbnails and SSO support when enabling providers; readiness reports missing capabilities. The
default Maximal package and Enterprise provide image and SSO support; Lite omits them. The authority loads Mantle and the
framework security, wiki, entity, job, search, and mail facilities. A local PASS instance loads
the authority in the same runtime. A remote presentation runtime loads framework, webroot, and
PASS, with its own framework session database and no Mantle business entity catalog. It does
not need BOSS. Do not expose internal worker services through additional REST/RPC routes.

Leave `pass_backend_url` unset for local mode. For remote mode, set these properties on the
frontend through deployment configuration or environment variables:

| Property | Purpose |
| --- | --- |
| `pass_backend_url` | Fixed authority origin/base URL; use TLS in production. `edge:` on an edge node: its local node, over the edge link |
| `pass_client_id` | Registered deployment ID |
| `pass_client_secret` | Server-side deployment secret |
| `pass_backend_transport` | `rest`, `grpc`, or empty for automatic (below) |
| `pass_backend_grpc_url` | The authority's gRPC listener for direct gRPC, such as `grpcs://boss.example.test:4317` |
| `pass_backend_web_url` | The authority's web address for the browser's SSO front channel; defaults to an http(s) `pass_backend_url`, and is needed with `edge:` (the local node's host name, through the edge node's web access) |

The same operations go to the authority by one of three transports, which callers cannot tell apart (the same results
and error kinds; `service/pass/Transport.js`):

- **REST**: the authority's `/rest/s1/pass/v1/sites/<siteId>/...` routes at `pass_backend_url`, the client's ID and
  secret in headers. Every package has it.
- **gRPC, direct**: the authority's gRPC listener (`pass_backend_grpc_url`), one long-lived HTTP/2 connection; the
  client's ID and secret in metadata. In Maximal and Enterprise.
- **gRPC on the edge link**: `pass_backend_url=edge:` on an edge node; its local node is the authority, and the link
  is the client (no secret, no public authority). Edge nodes are Maximal.

The transport rule: `pass_backend_transport` `rest` or `grpc` forces one. Empty is gRPC when the package has the
host's gRPC binding and a gRPC endpoint is set (`pass_backend_url=edge:`, or `pass_backend_grpc_url`), else REST, so
a frontend never moves to an authority port nobody opened. Lite and Dev have no gRPC: REST is their default and a
supported mode for the long term. `grpc` with no `pass_backend_grpc_url` dials the `pass_backend_url` host on port
4317, and `edge:` takes gRPC only. Settings that cannot work fail each call as unavailable, naming the setting in the
log.

`grpc://` is plain HTTP/2: to an authority on another host it sends the client's secret, and the visitors' credentials
and data, in clear; use it on loopback or a private link only, and `grpcs://` otherwise. `grpcs://` trusts the WebPKI
roots only; an authority certificate from a private CA is not accepted yet.

On the authority, register `pass_client_<id>_secret` and comma-separated
`pass_client_<id>_sites`. Register the exact frontend SSO callback URI in
`pass_client_<id>_callback`, such as `https://forum.example.test/account/Sso`. For direct gRPC, also set
`pass_authority_grpc_enabled=true`: the host's gRPC listener (port `pass_authority_grpc_port`, 4317, on
`pass_authority_grpc_host`; the OTLP receiver's port when that is on too) then takes PASS calls, TLS with the HTTPS
listener's certificate. With no certificate it serves plain h2c, and then takes PASS calls only on a loopback address,
unless `pass_authority_grpc_insecure=true`. For an edge node, the local node's client ID for it is
`pass_edge_client` (default `edge`):
set `pass_client_edge_sites` and `pass_client_edge_callback` (no secret; the link authenticates it).
Delegations are hashed, revocable, site/client scoped, and expire after 15 minutes without use;
use in the last five minutes extends them, up to twelve hours from sign-in, after which sign-in is
required again. A failed write retains its draft and operation ID. Every authority call carries the
deployment's client ID and secret (a credential is refused from any other caller) and the browser's
address, which the authority trusts only from a registered client for its rate limits. Password changes, account
termination/disable, or ending the issuing visit invalidate delegations. Credentials and the
authority's session for a second factor in progress stay in the frontend's server-side session: REST keeps the
authority's session cookie, gRPC the same session as an opaque handle (the signed session id) that each account call
carries and the authority renews when it rotates the session.

### An edge node as the PASS server

A business whose authority (its BOSS server) runs in the office, behind a firewall, serves its sites from an edge
node: a small cloud server the authority dials out to and keeps one link open with (mr-moqui `docs/Run-Deploy.md`,
"A local server with an edge node", and `plans/Edge-Node.md` §5.5). The edge node
runs mr-pass with `pass_backend_url=edge:` (set in its `MoquiEdgeConf.xml`), so it calls the authority over gRPC down
the link, and the authority needs no public address, open port or client secret for it.

1. Pair the authority with the edge node: on the edge node, System › Edge Clients, make a pairing code; on the
   authority, System › Edge Node, Pair with an edge node, with the edge node's address and the code.
2. In the wizard's Discover step turn PASS on, choose the sites the edge node serves and enter the frontend's SSO
   callback. Apply writes `pass_edge_client` (`edge`), `pass_client_edge_sites` and `pass_client_edge_callback` to the
   authority's `runtime/.env`, and its Test step checks them and that the edge node has mr-pass.
3. On the edge node, set `pass_backend_web_url` to the authority's web address through the edge node (a host name with
   web access, which the wizard's Discover step sets too), for the SSO front channel, and add the sites' `public-site`
   bindings to its conf.

While the link is down every PASS page fails as unavailable; a read cache on the edge node is later work.

## Host and mount bindings

Configure the public routing allowlist on each presentation runtime:

```xml
<webapp-list><webapp name="webroot">
    <public-site host="forum.example.test" site-id="OPERATOR_ASSIGNED_SITE_ID"
            screen-location="component://mr-pass/screen/Pass.xml"
            resolver-service="pass.RouteServices.resolve#Route">
        <mount path="/forum" screen="Forum"/>
        <mount path="/account" screen="Account"/>
        <mount path="/members" screen="Members"/>
        <mount path="/sites" screen="Sites"/>
    </public-site>
</webapp></webapp-list>
```

Use the operator's `mantle.public.SiteServices.store#Mounts` operation to register the same host
and app paths at the authority. Hostnames are unique; mounts must not overlap or occupy framework,
API, authentication, token, asset, or operational paths. One app per site may use `/`: Forum or Shop. Keep the runtime
allowlist aligned when changing mounts, and reload runtime configuration after changing it.
Unknown public hosts are concealed. The request cannot replace the routed site or configured
backend. Existing framework token routes retain their handlers.

At a trusted proxy, configure the framework's proxy/origin settings for the actual deployment.
Do not trust arbitrary forwarded authority headers or use a wildcard origin policy in production.
Cookie-authenticated changes require the framework session token. Return paths stay local; SSO
handoffs use the exact registered callback, browser state, a server-held verifier, and an expiring
single-use exchange code. Configure allowed provider IDs in `pass_sso_flows`; they reuse the
framework OIDC/OAuth facilities and account/second-factor policy. SAML remains unavailable where
the framework package does not provide it.

## Billing and Supplier apps

Billing (an organization's customer invoices and their pay links) and Supplier (a supplier's quotes, purchase orders and
bills: Purchasing's SupplierHome, QuoteResponse and OrderAcknowledgement, and Accounting's BillUpload) are PASS apps beside
Forum. Each serves one internal organization, its mount's target, which only an operator sets:

```json
{"siteId": "...", "expectedRevision": 3, "mounts": [
  {"app": "forum", "pathPrefix": "/forum"}, {"app": "account", "pathPrefix": "/account"},
  {"app": "billing", "pathPrefix": "/billing", "targetId": "ORG_ID"},
  {"app": "supplier", "pathPrefix": "/supplier", "targetId": "ORG_ID"}]}
```

A site owner's save of the core mounts (SiteDetail) keeps them. Add `/billing` and `/supplier` to the runtime's
`<public-site>` mounts (screens `Billing` and `Supplier`). A site without Forum serves only these and Account, and its
pages show those apps' navigation. Readiness adds each app's checks: the target is an internal organization, the
organization has an invoice payment gateway (Billing), bill files can be scanned (Supplier) and the site has a canonical
host, from which every link Mantle mails is built.

- **Links.** An invoice's pay link (`/billing/InvoicePay?token=`) comes from Mantle's `send#Invoice`; a purchase order's
  link (`/supplier/OrderAcknowledgement?token=`, with BillUpload beside it) from `send#PurchaseOrder`, for the revision
  sent, and its bill-only link (`/supplier/BillUpload?token=`) from BOSS's order screen; a quote's link
  (`/supplier/QuoteResponse?token=`) from `send#QuoteRequest`. Once an order is revised, the older revision's link says
  so and acknowledges nothing, though it still takes a bill; a cancelled order's and a closed quote's links are revoked; each is an `ExternalAccessCapability` with
  only its token's digest kept. A link opens one record of its organization's site, until it expires or is revoked;
  anything else says the page is not available. A new pay link ends its issuer's earlier ones (the organization's, or
  a contact's). Every link lookup counts against a limit per requester, and a site needs a canonical host for links to be
  made. The requester is the browser's address a registered remote frontend forwards, else the request's own: behind a
  proxy or load balancer, configure the framework's trusted proxies (see Host and mount bindings) so it is the browser's,
  not one shared by every visitor.
- **Contacts.** `mantle.party.ExternalAccessServices.invite#Contact` invites a customer's or supplier's contact to the
  app; redeeming the invitation (Account's Invitation page) gives the account a contact grant for that party on that
  organization's app only. The account holds no user group. A signed-in contact sees the customer's invoices under Billing's Invoices and can make a
  pay link to share; a supplier's contact (invited by AP or, from BOSS's Supplier360, a buyer) sees the supplier's quotes,
  orders and bills on Supplier's SupplierHome. Set the site's registration to invitation so invited contacts can register.
- **Payment.** Set the organization's invoice payment gateway (`PartyAcctgPreference.invoicePayGatewayConfigId`, one of
  its PaymentGatewayOrganization bindings; BOSS Accounting Preferences). A hosted gateway takes the payer to its page from
  a link on the payment result and sends them back to `<billing mount>/InvoicePay/return?attemptId=&key=`, whose
  reference reads that attempt on any device; the result comes from the gateway's details service, never from the
  return's parameters. The reference reads the attempt while it is pending and for a day after it settles. Keep the
  `resolve_PortalPayments` job running: it settles payments whose payer never comes back, and an attempt pending for
  seven days is taken as abandoned. The content security policy stays
  `form-action 'self'`: no form posts to the provider. The test gateway (`PaymentTestServices.hostedPending#...`) is for
  tests and demos only.
- **Bills.** A supplier's file is staged under `pass_media_root/bills`, checked to be the PDF, PNG or JPEG it says by its
  leading bytes, scanned by `pass_scanner_service` (at most 10 MiB) and becomes the incoming draft bill's file only when clean; a repeat of the request or of the
  supplier's bill number answers the first submission. AP reviews the bill in BOSS; nothing here approves it.
- **Quotes and acknowledgements.** A supplier saves a private draft of its quote and sends it, or acknowledges an order's
  current revision with its promised dates; either may carry a file, staged and scanned as a bill is (under
  `pass_media_root/supplier`), and a drop-ship supplier reports what it shipped. Each is a claim the buyers review in
  BOSS; a repeat answers the first receipt, and the posts are limited per requester.

A remote frontend posts a link's writes (a payment, a bill, a quote and its draft, an acknowledgement, a delivery report)
with no member session; the authority accepts those operations (`TOKEN_WRITES`) only from a registered deployment.

## Support app

The Support app (`screen/Support.xml`, the `support` mount) is Customer Service's customer pages, served for one internal
organization, its mount's target, like Billing and Supplier: `{"app": "support", "pathPrefix": "/support", "targetId":
"ORG_ID"}`, and `/support` in the runtime's `<public-site>` mounts (screen `Support`). Its pages are SupportHome (help),
MyCases, NewCustomerCase, CustomerCase, MyReturns, RequestReturn, CustomerReturn, CustomerArticle and Feedback. Readiness adds
the app's checks: the target is an internal organization with a service policy and a feedback delivery policy, and the site
has a canonical host. Which queues and case types a signed-in customer may file into, and which knowledge spaces its help
reads, are the organization's Support app settings (BOSS Customer Service › Settings › Service defaults; empty: the default
queue and every customer and public knowledge source).

- **Customers.** A customer's contact is invited from BOSS (Customer Service › Customers › a contact › Invite to support),
  through `invite#Contact` with the `support` app; redeeming the invitation (Account's Invitation page) lets the account see
  and file its own cases and returns, a customer administrator every case of the customer. A customer who is a person
  reaches their own cases and returns with no invitation, once their account's email is verified. Set the site's
  registration to invitation, or open for consumers. Matching an email domain never makes anyone a customer's contact.
- **Cases.** NewCustomerCase files a case in one of the offered queues (the queue's priority, assignment and service level),
  with the case type's template fields for the customer and a file; with an order selected it also asks to cancel the
  order's open lines ("Cancellation requested" for an agent unless the organization cancels at once). A queue's public form
  is `/support/NewCustomerCase?token=`, the queue's intake token (BOSS Channel routing); a sender the organization does not
  serve is held for review and reads nothing. CustomerCase shows the case's outward messages and the files shared with the
  customer only, and takes a reply, a file while open, a reopen within the window and a cancel; a case's link
  (`/support/CustomerCase?token=`) opens it signed out. Outside the queue team's working hours the pages say when the team
  replies next.
- **Returns.** RequestReturn offers an order's lines under a self-service return policy, within its window; the server picks
  the receiving facility. The RMA mail's link (`/support/CustomerReturn?token=`) shows the return, its label and tracking,
  takes evidence and a withdrawal before the goods are received.
- **Help.** SupportHome and CustomerArticle read the published pages of the organization's customer and public knowledge
  sources (a visitor only public ones); a rating counts once per page view, 30 in ten minutes per requester.
- **Files.** Case files and return evidence are staged under `pass_media_root/support` and scanned as a bill is (PDF, PNG or
  JPEG, at most 10 MB); downloads go through the facade, which a remote frontend streams.

- **Feedback.** A resolved case's customer gets one invitation by email from the organization's address, after the
  feedback delivery policy's delay (BOSS Customer Service › Settings › Service defaults); its link,
  `/support/Feedback?token=`, is an `ExternalAccessCapability` of the invitation that ends when the invitation expires,
  each send and reminder its own. Keep the `send_CaseFeedbackInvitations` job running (every 15 minutes, a bounded batch).
  The page shows the organization's feedback form as of now and the customer's name, never the case; a GET answers
  nothing, so a mail scanner following the link submits no rating; Send my answer posts the answer, which the authority
  checks again, keeps once and limits per requester (30 posts and 100 link lookups in ten minutes); a repeat shows the
  first answer's receipt. An expired, withdrawn or forged link shows only guidance. The page loads the framework's
  `/js/moqui-form-when.js` for the form's show and require rules (the CSP stays `script-src 'self'`).
- **Access.** A customer's account is a public account holding no user group; the Support pages answer only that customer's
  own records (another customer's case, return or file is "not available", whatever the request names). Where BOSS runs in
  the same runtime, its roots, Commons and Comms among them, are authorized only for its staff (`BOSS_USERS`), so a public
  account opens none of them; every Customer Service screen and service refuses it too.
- **Remote frontend.** `getCaseFeedbackInvitation`, `submitCaseFeedback` and the `support/...` operations are PASS operations
  served by Mantle's PassApi; the writes a link's token authorizes (the feedback answer, a queue form's request, a case link's
  reply, reopen and cancel, an article rating, an RMA link's evidence and withdrawal) are `TOKEN_WRITES`, accepted from a
  registered deployment without a member session.

## Shop app

Shop is a ProductStore's storefront (`screen/Shop.xml`, app `shop`; [design](../plan/design-shop.md),
[plan](../plan/impl-shop.md)). An operator mounts it with `store#Mounts`, its target the store (a ProductStore of an
internal organization); it may be the site's root app in place of Forum, and a site has one Shop mount. Account, Billing,
Support and the framework's paths keep their owners under a root Shop: the longest mount wins, and the framework's own
routes (`/rest`, `/static`, `/assets`, `/s`, `/u`, `/r` and the rest) are never a site's. For a root Shop the runtime's
`<public-site>` names `<mount path="/" screen="Shop"/>` beside the other apps' mounts. Shop's pages are concealed (Not
Found) until the site is published and its Shop mount enabled. The site's readiness (`checkReadiness`) adds Commerce's
store readiness (`mantle.product.StoreAdminServices.check#StoreReadiness`) under `shop`. On a Shop site the Account,
Billing and Support pages keep the PASS shell with the site's brand values from `PublicSite.theme` (a small JSON object:
`primaryColor`, `backgroundColor`, `textColor`, `surfaceColor` as six-digit hex colors, `logoUrl` a local path or https; an https logo's origin joins the shell's `img-src`).

Responses are `no-store` with the shell's CSP unless a route in `screen/Shared/Headers.js` says otherwise.

**Themes** (impl-shop P2; design-shop §12). Commerce staff start a theme from the starter (`theme/starter/`, starter
`mr-pass/starter`), validate and publish it to a site's Shop mount (`mantle.public.ThemeServices`); with a published
release Shop's pages are the release's own documents instead of the PASS shell, and its assets are served under the
mount at `theme/{manifest digest}/{path}`, immutable. A remote frontend fetches the active release's manifest and files
over its authority connection (registered clients only), checks every digest and keeps the release; one it cannot
verify, or an engine or view API it does not have, shows a safe "not available" page. The renderer's budgets are
lowered in conf with `<resource-facade><theme-limits .../>` (mr-moqui `docs/ui/Themes.md`).

## Adding an app

An app registers in these places: its name, target type and readiness service in the authority's
`mr-mantle/service/mantle/public/PublicApps.js` (`root` if it may mount at `/`, `onePerSite` for one mount a site); its root
screen and default path in `service/pass/Apps.js`; a `subscreens-item` of `screen/Pass.xml`; its branch of the header's
navigation (`screen/Shared/Header.html.fancy`); its operations in `service/pass/Schema.js` and `Routes.js` with Mantle's
copies (`ForumSchema.js`, `script/PassRoutes.js`), which Forum's spec keeps identical, each mapping to a Mantle service
taking PASS's `input` map; a bearer link's write in the three `TOKEN_WRITES` lists (`service/pass/Transport.js`, Mantle's
`script/PassApi.js` and `script/PassAuthority.js`); a refusal reason a page shows in `PassAuthority.js`'s `REASONS` and
`screen/Shared/Portal.js`'s `reasons`; its mount in the test runtime (`test/MoquiConf.xml`) and Portals' spec's list of
targeted apps. Then mount it in the runtime's `<public-site>`.

## Provisioning and publication

Provision through an authenticated operator context using
`mantle.public.SiteServices.create#Site` with `input: {name, ownerPartyId, locale, timeZone}`.
The owner must be an existing backend Party. Sites start disabled with registration closed.
Use the Sites screen or the typed site operations to set identity, host/app bindings, registration
policy, owners, and exact-version wiki guidelines/about bindings. Owners cannot remove the last
active owner. Role delegation requires reauthentication and a decision reason. Membership decisions require
a current revision; legacy mailbox changes advance that same revision. Bound category owners
also require an active replacement before leaving or losing their role.

Create categories through `mantle.forum.ForumServices.store#Category` with a durable `operationId`.
Preview their audience before explicitly publishing with the current category revision.
Ancestors impose access ceilings. Public, site-member, category-member, and help audiences use
the same evaluator as bound mailbox operations. Help members see their own participation.
Category publication is independent of the legacy list's `isPublic` flag.

Adopt existing mailboxes through `bind#Mailbox`, confirming the current audience. The conversion
job seeds chronological ordinals, retains event IDs and closed state, and writes revision
snapshots without historic notifications. Publication and new bound posts stay blocked until
reconciliation succeeds. For an unbound legacy mailbox, an operator may call the internal
`mantle.forum.BootstrapServices.start#Mailbox` service first. Inspect failed roots, repair their
source metadata, then retry the checkpointed job. Existing personal markers prevent silent
ordinal renumbering.

## Mail, accounts, and media

Configure a framework EmailServer and verification EmailTemplate, and set
`pass_verification_template`. The verification template receives `verificationToken`; render a
link/code for the deployment's Register page. Never put provider credentials in site records.
Public signup creates a disabled framework account. Verification is single-use; verified site
joining links/creates the backend Party without assigning an internal group. Invitation signup
requires its intended email and a valid invitation token.

Register comma-separated `pass_sender_addresses` and `pass_mail_template_ids` on the authority.
The selected template's configured sender must match the registered sender. Configure per-site
mail settings through the Mail screen. Notification templates receive `title`, `siteId`,
`rootCommEventId`, `postId`, `postUrl`, `reason`, and `unsubscribeUrl`; mailing-list (Every post)
mail also receives the sanitized post as `body`, and a digest receives `topics` (`title`, `url`).
Private conversation notices carry only a generic title and link. Forum email opt-out changes
delivery preferences, not membership or in-app notifications, and may be widened to the whole
site. Replies thread under the member's earlier mail through In-Reply-To and References.
Posting policy defaults (two first contributions held for approval, ten seconds between posts,
trust-level daily and per-post limits) are set per site on the Policies screen, which accepts
only settings at least as strict as the defaults.

### Inbound email

Register the domains forum route addresses may use in comma-separated `pass_route_domains` on
the authority. Site owners then add route addresses on the Mail screen: a category address starts
topics and accepts replies; an address without a category accepts replies only. Each email notice
carries a reply address with a hashed, expiring token in its plus tag, issued to that recipient for
that thread. Point the route addresses at a hosted or shared mail account behind the trusted edge
gateway (`docs/interfaces/Mail-Inbound.md` in mr-moqui) or at a synced account; the `ForumInbound` email ECA
handles each stored message. Set the gateway's `smtp_authserv_id` so only its
`Authentication-Results` are kept: a sender must be one verified account address with DMARC, or
aligned DKIM, passing there. Nothing creates accounts from mail, and unknown senders get no reply.
Automatic replies and the forum's own mail are ignored, delivery reports mark hard bounces and
stop that member's email, and a failed message can be retried from the Mail screen.

### Automated classification

Classification is off by default. To offer it, set `pass_classifier_service` to an internal
service taking `siteId`, `postId`, `revision`, and `text` and returning `decision` (`review` or
`ok`), `model`, `version`, and `reason`; owners then enable it on the Policies screen. Results only
file review items. Keep provider credentials in that service's own configuration.

Set `pass_media_root` to private backend storage and `pass_scanner_service` to an internal service
accepting `location` and `mimeType`, returning Boolean `clean`. The scanner must inspect actual
bytes and reject unsafe/mismatched content. Missing/failed scanning quarantines content. Forum
uploads accept at most 10 MiB and the S1 raster image, PDF, and plain-text types. HTML/SVG and
programs are rejected. Uploaded files finalize only with the current actor's permitted post.
Profile images use the same scanner and private storage, finalize against a revision-protected profile,
and follow its current visibility. Replaced avatars and detached post attachments expire after
seven days. Downloads and PNG thumbnails recheck current parent access; storage paths are never public DTOs.
The shared outbound multipart transport rebuilds bounded bodies from server-owned uploads, and
remote downloads use the framework response forwarding facility.

## Workers and recovery

Seed jobs dispatch outbox delivery, mailbox/tracking conversions, bookmark reminders, topic
timers and the classifier queue each minute, recompute trust every ten minutes, and prepare digests
and clean expired staging each hour. A topic timer rechecks its topic's category and its creator's
moderation access when it fires, and is cancelled otherwise. Staged, unfinalized uploads expire after seven days. Framework jobs clean expired
account challenges and throttle buckets. Confirm that the normal scheduler is running.

Workers page recipients in batches of 100. Public members receive no per-post recipient rows;
only enabled accounts with an active non-ALL_USERS group qualify for internal MAILBOX receipts,
including named recipients and mentions. Group changes take effect on new writes immediately.
Checkpointed conversions preserve conservative unread boundaries and never fabricate historic
individual receipts.

Use Operations for backend checks, scan backlog, outbox lag, failures, and checkpoint recovery.
Use Mail to reconcile delivery outcomes with provider evidence. Explicit SMTP transient rejection
retries with bounded exponential backoff, up to five attempts. Permanent failures stop.
Interrupted/ambiguous sends remain uncertain and are not automatically resent. Confirm provider
acceptance or non-acceptance before recording the resolution; retries recheck current access.
Each independent failed item is named in logs and peers continue. Security checks, revision
conflicts, and atomic post transactions fail closed.

Pagination uses random, actor/scope-bound cursor records expiring after 15 minutes; tokens expose
no internal identity or offset fields. A scheduled job removes expired cursor records.

PASS responses use `no-store` for public/private personalized reading and protected media; there
is no shared anonymous response cache to invalidate. Visibility generations advance on relevant
changes. The stream polls for changes and clears inaccessible content. The S1 search reads the
authority's database and rechecks policy; legacy indexed mailbox hits are revalidated before
projection and stale aggregate counts are suppressed.

## Entitlements, operations and imports

Paid access uses Mantle subscriptions. An operator binds a `SubscriptionResource` to a site, category
or article in Site settings; the binding names the forum's access services on the resource, and a
resource that already has other services is refused. Order approval then grants access per
subscription period. Mantle's `expire_SubscriptionAccess` job (every ten minutes) calls each
resource's revoke and destroy services once after a subscription ends, skipping one a later
subscription continued, so keep it unpaused. Categories admit subscription grants only when their
qualifying sources include `subscription`. Set `subscriptionUrl` on the site to link members to the
page where they manage a subscription; Forum implements no checkout.

`pass_dispatch_operations` (every minute) advances operation runs: counter rebuild, delivery retry,
retention, site and personal exports, erasure and Discourse import stages. Each item runs in its own
transaction and each run advances in its own. Retention runs only when a site owner starts it with
the previewed policy revision; nothing prunes automatically. Exports and reports are written under
`pass_media_root/exports`, expire after seven days, recheck the requester's authority when
downloaded, and are removed by the cursor cleanup job. Set `publishingWikiSpaceId` on the site to
let internal staff draft articles from topics into that wiki space.

Set `pass_import_dir` to an operator-managed directory that holds Discourse backup archives. The
browser only names a file there and its SHA-256; imports expand into `pass_media_root/imports` and
run into a disabled site. Activation needs the operator's and a site owner's approval of the same
reconciliation, a frozen source and a backup reference. Proxies can send old community URLs to
`<forum mount>/legacy?path=...`; old `/t/slug/id` links redirect on their own.

## Reproducing the remote check

`RemoteHttp` and its `RemoteFixtures` are acceptance tests, in `acceptance/`. Start an authority fixture on a dedicated loopback port:

```sh
./moq test mr-pass --nobuild --acceptance --spec ClientFixtures,PortalFixtures,SupplierPortalFixtures,SupportFixtures --db snapshot --serve 127.0.0.1:18091
```

Create a separate scratch runtime containing only symlinks to framework, webroot, tools, and PASS.
Copy the normal runtime configuration needed for the frontend and add the remote properties above,
using the isolated test client ID/secret from `test/MoquiConf.xml`. Do not copy Mantle or BOSS into
that runtime. Run `RemoteFixtures` (`--acceptance`) with `MOQUI_RUNTIME` set to that directory, its remote conf,
and `--serve 127.0.0.1:18092`; it asserts the Mantle entity catalog is absent. Then run:

```sh
./moq test-client runtime/component/mr-pass/acceptance/client/RemoteHttp.spec.js --nobuild --server http://127.0.0.1:18092
```

That run is REST; build the frontend with `--lite` to check REST on Lite. The same test runs over each gRPC transport
with the Maximal package (`--release`) on both runtimes.

gRPC direct (the authority on loopback serves h2c, which loopback allows). When the authority's conf turns on the
OTLP/gRPC receiver (`MoquiDevConf.xml` has `<receiver grpc-enabled="true"/>`), the PASS authority shares the receiver's
port (4317) and `pass_authority_grpc_port` is ignored: run the authority with a conf that leaves the receiver off, or
point `pass_backend_grpc_url` at 4317.

```sh
./moq test mr-pass --release --spec ClientFixtures,PortalFixtures --db snapshot --serve 127.0.0.1:18091 \
    -D pass_authority_grpc_enabled=true -D pass_authority_grpc_port=18093
# the frontend's conf: the remote properties above, and
#   pass_backend_grpc_url=grpc://127.0.0.1:18093   pass_backend_transport=grpc
MOQUI_RUNTIME=<frontend runtime> ./moq test mr-pass --release --nobuild --acceptance --spec RemoteFixtures --serve 127.0.0.1:18092
./moq test-client runtime/component/mr-pass/acceptance/client/RemoteHttp.spec.js --nobuild --server http://127.0.0.1:18092
```

gRPC on the edge link: the frontend is an edge node, which the authority runtime pairs with. Pairing checks the edge
node's certificate by WebPKI, so its runtime needs a certificate for a public name of the machine in `cert/`
(`edge.example.test` below; a self-signed one is refused):

```sh
./moq test mr-pass --release --spec ClientFixtures,PortalFixtures --db snapshot --serve 127.0.0.1:18091 \
    -D pass_client_edge_sites=PASS_AUTH,PASS_HTTP -D pass_client_edge_callback=https://frontend.example.test/account/Sso
# the frontend's conf: pass_backend_url=edge:, pass_backend_web_url=http://127.0.0.1:18091, node_role=edge,
#   webapp_https_listen_port=18443 (no pass_client_id or secret: the link is the client)
MOQUI_RUNTIME=<frontend runtime> ./moq test mr-pass --release --nobuild --acceptance --spec RemoteFixtures --serve 127.0.0.1:18092
# on the frontend, signed in as john.doe: System › Edge Clients, make a pairing code; on the authority
# (http://127.0.0.1:18091): System › Edge Node, pair with https://edge.example.test:18443 and the code, wait for Linked
./moq test-client runtime/component/mr-pass/acceptance/client/RemoteHttp.spec.js --nobuild --server http://127.0.0.1:18092
```

Run the authority with `--acceptance --spec ClientFixtures,PortalFixtures,SupplierPortalFixtures,SupportFixtures` for the
Billing, Supplier and Support features; the browser walks `SupplierPortalHttp` and `SupportFeedbackHttp` run against the
same frontend too. The test
authenticates through the authority, saves a private draft, uploads/scans/publishes media,
downloads it through the frontend, then revokes anonymous access and verifies concealment. It
also uploads a profile image and verifies that changing profile visibility conceals the image, then opens a pay link,
starts its payment and sends a supplier's bill, and sends a supplier's quote with its file and acknowledgement through
the remote frontend.
Stop both disposable servers after the run. `./moq accept mr-pass` also runs RemoteHttp against its served server
(local authority, no remote frontend); it has its own fixture invoice, apart from PortalHttp's; on a build without image
support its two image features skip with that reason. Live SMTP, IdP, DNS/TLS, and production scanner checks
remain deployment-specific; the specs use captured mail, a deterministic scanner, and isolated data.
