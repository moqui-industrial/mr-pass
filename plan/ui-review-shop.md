# IronStone PASS — UI review: Shop

Nov 10, 2026 — documentation planning baseline. Live review has not started.

This file plans the review of the implemented public Shop. It is the companion to
[Commerce's UI review](../../mr-boss/plan/ui-review-commerce.md), whose staff actions supply the store, public
catalogue, content, offers and operating evidence. Creating this plan does not advance live coverage.

## 1. Purpose, scope and sources

Review a customer's complete purchase and after-purchase journey through the current Shop, including physical
products, digital delivery, prepaid access and recurring subscriptions. The review must establish that a person can
understand the offer, complete or recover a purchase, and reach only their own account and order information.
It must also establish that the staff action and public result agree without requiring BOSS in the storefront runtime.

This is a review plan and running record, not an implementation specification or evidence that the current UI passed.
The documentation batch creates this file and its Commerce companion only. It does not change applications, APIs,
fixtures, existing documents or tests; run a build, runtime, walkthrough or test; or create a commit.

### Inputs and reference patterns

Current source takes precedence over a historical design or implementation status. Read the following before a later
execution session and record its revisions rather than silently treating this baseline as current forever.

| Source | What this plan uses it for |
| --- | --- |
| [PASS README](../README.md), [deployment guidance](../docs/Deployment.md#shop-app) | Runtime dependencies, site routing, local/remote authority, cache, provider, media and job prerequisites |
| [Application practices](../../../../docs/dev/Practices-App-Dev.md), [build and test rules](../../../../docs/Build-Test.md), [testing skill](../../../../.agents/skills/testing/SKILL.md), [building skill](../../../../.agents/skills/building/SKILL.md) | Ownership, future validation classification and execution boundaries; reading them does not authorize a run |
| [UI review guide](../../../../docs/dev/UI-Review.md), [document convention](../../mr-boss/plan/design-doc-guide.md#ui-review-and-refinement-phase), [style guide](../../mr-boss/plan/style-guide.md) | Seven-part review record, activity method and interaction criteria; BOSS shell/TUI rules are not automatically Shop requirements |
| [Accounting review](../../mr-boss/plan/ui-review-accounting.md), [Customer Service review](../../mr-boss/plan/ui-review-customer-service.md), [Warehouse review](../../mr-boss/plan/ui-review-warehouse.md) | Depth, evidence discipline and settlement/return/fulfillment boundaries |
| [Shop design](design-shop.md), [Shop implementation record](impl-shop.md) | Intended journeys, historical dispositions and identified later scope; there is no separate Shop research document assumed here |
| [Commerce research](../../mr-boss/plan/research-commerce.md), [design](../../mr-boss/plan/design-commerce.md), [implementation](../../mr-boss/plan/impl-commerce.md) | Existing comparison patterns and the staff side of publication, pricing, recovery, subscriptions, feeds and operational evidence |
| [Shop root](../screen/Shop.xml), [Shop descendants](../screen/Shop), [PASS root](../screen/Pass.xml), [route resolver](../service/pass/RouteServices.xml) | Actual routes, fallback behavior, transitions, mounts and linked applications |
| [Catalogue rendering](../screen/Shop/Catalog.js), [cart](../screen/Shop/ShopCart.js), [checkout](../screen/Shop/ShopCheckout.js), [account](../screen/Shop/ShopAccount.js), [subscriptions](../screen/Shop/ShopSubscriptions.js) | The controls a shopper can actually use and their redirects, session capability handling and refusals |
| [Theme adapter](../screen/Shop/ShopTheme.js), [preview adapter](../screen/Shop/ShopPreview.js), [starter package](../theme/starter) | Full-document rendering, verified immutable releases, trusted components, preview boundaries and assets |
| [Reviews](../screen/Shop/ShopReviews.js), [recovery](../screen/Shop/ShopRecovery.js), [feeds](../screen/Shop/ShopFeeds.js) | Public moderation outcome, deliberate recovery-token consumption and generated outputs |
| [Facade](../service/pass/Facade.js), [operation definitions](../service/pass/Facade.xml), [transport](../service/pass/Transport.js), [public-page helper](../screen/Shared/Portal.js), [headers](../screen/Shared/Headers.js) | Local/remote parity, error envelope, capability reads/writes, no-store defaults and narrowly public responses |
| [Mantle Shop catalogue](../../mr-mantle/service/mantle/product/ShopCatalogServices.xml), [cart](../../mr-mantle/service/mantle/order/ShopCartServices.xml), [checkout](../../mr-mantle/service/mantle/order/ShopCheckoutServices.xml) | Store-derived price and publication, cart revisions, freeze/payment/placement contract |
| [Shop customer](../../mr-mantle/service/mantle/party/ShopCustomerServices.xml), [fulfillment](../../mr-mantle/service/mantle/product/ShopFulfillmentServices.xml), [subscriptions](../../mr-mantle/service/mantle/product/ShopSubscriptionServices.xml), [operations](../../mr-mantle/service/mantle/order/ShopOperationsServices.xml) | Ownership, grants, invoicing, repeated work, cancellation and recovery semantics |
| [Theme authority](../../mr-mantle/service/mantle/public/ThemeServices.xml), [authority handler](../../mr-mantle/script/PassAuthority.js), [Support helper](../screen/Support/Support.js) | Publish/restore boundaries, registered deployments, identity and one-order Support continuations |
| [Shop regression sources](../test/Shop), [golden client walk](../test/client/Shop/ShopCheckoutWalk.spec.js), [acceptance sources](../acceptance) | Existing assertions, dependencies and remaining execution gaps; summarized in section 5 |

The research and design's existing references to PopRestStore, Ridgecrest, Shopify, Odoo and other commerce patterns
supply comparison questions, not a claim of parity or fresh external verification. For example, use composable themes,
clear purchase summaries and visible recovery to ask whether this implementation communicates its own supported state.
No third-party research was refreshed for this documentation batch.

### Ownership and boundaries

| Owner | Shop uses or shows | Boundary to preserve |
| --- | --- | --- |
| PASS Shop | Published catalogue/content, trusted purchase/cart/checkout, orders, account purchases, downloads, subscription self-service, reviews and recovery | Public HTML application; it does not inherit BOSS's application shell or terminal workflow |
| PASS Sites and Account | Host/mount policy, registration, verification, sign-in/out, identity, account hub and email preferences | Operator owns the Shop target; verified identity is distinct from possession of a guest order capability |
| BOSS Commerce | Store readiness, assortment/publication, website pages/navigation, theme drafts/preview/releases, offers/promotions, operational orders/carts/customer context, reviews, recovery, feeds/reports | Staff scope and capabilities do not become shopper permissions; Shop remains usable without a BOSS runtime |
| Mantle | ProductStore authority, customer price, current publication, cart/order/payment attempts, customer ownership, fulfillment/access and subscription state | Browser prices, store IDs, order IDs, callback claims and elapsed time are not authoritative |
| PASS Support / BOSS Customer Service | Order question, return request and cancellation request; authorized customer case/return follow-up | Guest `SalesOrder` / `OrderView` permits bounded one-order intake and receipts, not broad case/return lists or detail access |
| Warehouse | Physical reservation, shipment, delivery, return receipt and inspection | Shop shows available customer projections and tracking; it does not pick, ship or accept returns |
| Accounting | Payment holds, receipts/invoices, refunds and settlement | A return/cancel request is not a refund; `PAYMENT_HOLD_RELEASE` belongs to Accounting treasury, not ordinary Commerce operators |
| PASS Billing | Existing authorized invoice/payment presentation linked from Shop | An optional Billing link does not extend the Shop order capability to unrelated billing records |
| Provider and operations | Hosted payment/profile pages, lookup/webhook reconciliation, jobs, delivery ledger, mail and scanner | Provider success is confirmed through authority lookup; outage or an unresolved attempt must remain visible rather than produce a second charge |

Publication has several independent controls. An assortment/adoption proposal is not product publication; product
publication is separate from a page/navigation publication and from the active immutable theme release. Publishing or
restoring a theme changes the release pointer and generation, not the current product/page publication decisions.
Withdrawing a site/mount conceals its public UI without undoing placed orders or stopping authority reconciliation.

There are two supported deployment shapes. Local PASS loads Mantle and calls the same authority operations locally.
A remote frontend loads framework, webroot and PASS with one operator-configured authority; it has no Mantle business
entity catalogue and does not copy customer Party records. Both resolve the site's Shop mount to its ProductStore.
BOSS is a staff application and is not a required frontend or authority dependency for published Shop operation.

Use the [companion activity checkpoints](../../mr-boss/plan/ui-review-commerce.md#companion-activity-checkpoints) to
pair the COM and SHP activities for publication, offers, payment recovery, access, operational evidence, identity and
authority isolation. Record each side's evidence under the same store/site and record identities; completion of one
side does not complete the other or grant its owner's permission.

## 2. Review method and refinement criteria

### Future environment and fixtures

A later review starts by recording component revisions, fixture changes, site hosts and mount prefixes, active theme
release/digest, store, current publication generation, identity, browser, viewport and authority transport. Do not run
fixture setup merely to write or check this plan. Treat every mutable example below as a prerequisite to confirm later.

Adopt the [Commerce companion's common preparation](../../mr-boss/plan/ui-review-commerce.md#future-environment-and-fixtures):
one lifecycle owner coordinates a disposable runtime and database, copies mutable configuration, and keeps uploads,
downloads, captured mail and evidence separate from working data. Never symlink a mutable database or integration
configuration into that runtime; a component symlink still edits the source checkout. Distinct ports do not isolate
cookies: use separate staff/public/preview hostnames and independent customer sessions. Record runtime/database paths
and the process that owns them, retain scratch dependencies while it runs, then restore temporary grants/preferences/
configuration and stop listeners through that owner. Shop's additional local/remote and authority-only preview topology
is specified below; common preparation does not add a BOSS dependency to the public frontend.

| Fixture or prerequisite | Required starting condition and reason |
| --- | --- |
| Two stores/sites | `ZIZI_SHOP` / `shop.zizi.localhost` / `POPC_DEFAULT` and `ZIZI_DIGITAL` / `digital.zizi.localhost` / `BOSS_COM_DIGITAL` are concrete acceptance examples, not production targets; use distinct public products and the same buyer to expose cross-store leakage |
| Root and prefixed mount | A site with Shop at `/` and another at `/shop`; enabled Account, Billing and Support paths retain their owners. One Shop and one root app per site; Support targets the store organization |
| Themed and shell pages | A published starter-derived release and a valid store with no active release; published Shop uses its own document, while no-release Shop and linked Account/Billing/Support use PASS's branded shell |
| Public inventory | Published simple and virtual/variant products, excluded/unpublished/expired product, category subtree, physical stock bands, digital guide, zero/unavailable price, quantity pricing and a store-specific customer price |
| Content and releases | Published page plus a newer draft, navigation change, old slug, redirect, alternate template, valid release and restorable prior release; a deliberately invalid draft belongs only in an isolated future fixture |
| Preview topology | Separate preview host on the authority runtime with Mantle in process, preview host-check service and allowed BOSS frame origins; the remote public frontend treats hosts as live and does not serve draft previews |
| Shopper identities | Anonymous cookieless visitor; guest with a cart and one-order capability; verified buyer; unverified account; second buyer; shopper with orders in both stores; a signed-in account with an existing cart |
| Concrete fixture provenance | `ShopSpecLib` uses `PASS_SHOP_ORG`, `PASS_SHOP_STORE`, `PASS_SHOP_OUTSIDE`; `ShopWalkFixtures` adds `PASS_WALK_STORE`, `PASS_WALK_GUIDE`, `PASS_WALK_HOSTED` on `PASS_HTTP`. These rule/golden fixtures are not the same as acceptance sites |
| Client acceptance identities | `ShopFixtures` provisions `PASS_HTTP_SHOPPER` and `PASS_HTTP_SHOPPER_R` with separate carts, published demo products, terms and guide. Read its current setup and dependent `ClientFixtures`/`PortalFixtures`/`SupportFixtures` before reuse; do not invent passwords |
| Checkout configuration | Canonical public host, current terms, delivery options, required contact/address settings, shipping/tax calculation and hosted card gateway; opt-in topics offered only when configured |
| Payment cases | Hosted test success, decline/lost answer, pending/unknown, approved-but-unplaced and post-placement capture failure. A real sandbox account, callback route, provider configuration and operator permission are separate prerequisites |
| Fulfillment and documents | Approved physical, digital and mixed orders; valid digital file and grant; invoice/receipt links; refunded or revoked grant; supported byte ranges; order awaiting approval and capture hold |
| Subscription cases | Prepaid and recurring offers, resource, paid and manual access sources, saved method, off-session consent, paid-through date, due/failed/unresolved renewal and cancellation/refund cases |
| Review/media | Arrived-order verified buyer, no-purchase buyer, approved/pending/rejected review and scanned image. Private `pass_media_root`, scanner service and image support are explicit dependencies |
| Recovery and communications | Signed-in shopper has opted into the store's cart reminders; eligible unpurchased cart, single-use/replaced/expired recovery tokens, mail sink and delivery records. Guests are not recovery recipients |
| Outputs | Active feed builds for configured XML/CSV/JSON format, current sitemap/robots, current theme assets and product/review media; wrong digest, stale generation and withdrawn product cases |
| Operations | Checkout reconcile/expire, fulfillment, message delivery, renewal, Shop operations, recovery, feed and access-expiry jobs configured; controlled outage/paused-job fixtures and authorized staff to resolve exceptions |
| Remote frontend | Registered deployment, explicit authority URL/transport, canonical public/backend URLs, correct proxy/TLS/host settings and session/identity configuration; no business catalogue on frontend, no BOSS dependency |

Do not substitute a generic administrator for each actor. Use a site operator for mounts, a Commerce publisher/editor
for publication, a scoped Commerce operator for operational evidence, a customer-service worker for case/return/cancel
work, a warehouse worker for physical fulfillment and treasury for payment-hold release. Record the exact capability
and organization/store scope used for a staff handoff. `StoreStaff` scoping is not itself a capability grant.

Gateway credentials, live mail, scanner availability, DNS/TLS, reverse-proxy behavior, private file storage and real
phone/screen-reader behavior are unresolved execution prerequisites until recorded. The test gateway does not verify
Authorize.Net delivery, an actual bank/card outcome, live mail deliverability or a production CDN.
The implementation record specifically retains the Authorize.Net stored-credential sandbox check (Shop F106/F115),
including a card added outside a purchase without an original network transaction ID. Commerce F129 also distinguishes
fresh cart capability from HTTP session rotation: its historical walk uses `login()`, so it is not evidence of the real
password sign-in page carrying the cart across a rotated session. Keep both as future investigation inputs, not defects
observed by this review or prerequisites already proven by the test gateway.

### Modes and visual criteria

Use these mode labels in the activities and ledger. They describe future evidence, not alternate feature sets.

| Mode | Required inspection |
| --- | --- |
| H | Ordinary server HTML forms and links, with JavaScript disabled; labels, validation, full redirects, reload/back and capability handling remain usable |
| J | HTML with JavaScript enabled, purchase/cart Vue islands and checkout enhancement/polling; loading, stale revision and failure paths resolve clearly |
| N | Selected constrained layouts at 390 px, plus a smaller supported phone and landscape where available; touch targets and real-device keyboard behavior require direct evidence |
| D | Primary desktop target 1920×1080 and selected constrained layouts at 1280 px, keyboard-only operation and actual 200% browser zoom; long text, reduced motion, headings, landmarks, skip access and focus require direct evidence |
| L/R | Local and remote authority variants; repeat security, capabilities, checkout uncertainty, cache/outage and output boundaries across both |
| P | Public output/supporting inspection: HTTP status/headers, canonical links, feed/media/document/download bytes, active release and persisted authority state |

H/J are not BOSS Standard/Material render modes. The source has `text type="html"` templates and two trusted `.qvue`
islands; it has no Shop `.tui.json` or TUI workflow. Do not add an invented terminal checklist. A `.qvue` resource is
an enhancement surface, not a separate customer application. Inherited BOSS CSV/XLSX controls do not exist in Shop's
local tree; inspect the actual output inventory instead.

For each activity, inspect correct context; plain language; price/currency/quantity and availability; clear next action;
empty/loading/refused/stale/unavailable/success states; keyboard and focus order; screen-reader labels/live regions;
phone wrapping without horizontal page scroll; readable long names/addresses; reduced-motion behavior; and retained
customer state after navigation/release. A successful API response is not evidence that the customer understands it.
Measure contrast against the actual composited background: ordinary text at least **4.5:1**, qualifying large text
**3:1**, and meaningful controls/state indicators **3:1**. Inspect actual supplied light/dark theme or PASS-shell variants
at the stated viewports and 200% zoom; do not invent a Shop theme toggle where the selected package supplies none.

Refine only from a reproduced problem or a clearly bounded source concern. Record severity, affected actor/mode,
route and source, steps, actual and expected behavior, authority state, evidence and proposed owner. Distinguish a UI
refinement from a business-rule, data, environment, framework or provider issue. Never mark a static suspicion as an
observed defect. Retain failed attempts and empty states in evidence; sanitize tokens, customer data and payment details.

### Ordered waves

| Wave | Activities | Exit before moving on |
| --- | --- | --- |
| 1 — Public foundation | SHP-01–SHP-08 | Sites and routes are unambiguous, catalogue/content publication and release boundaries are visible, output prerequisites known |
| 2 — Cart and identity | SHP-09–SHP-12 | Current-price cart, promotions, stale edits, merge/sign-out and deliberate recovery work for the intended buyer |
| 3 — Purchase | SHP-13–SHP-18 | Contact/delivery/payment/review, hosted handoff, uncertain state and confirmation agree with one authoritative attempt/order |
| 4 — After purchase | SHP-19–SHP-25 | Guest and verified access, order/invoice/reorder, addresses/cards, downloads and fulfillment/settlement boundaries are bounded |
| 5 — Continuing relationship | SHP-26–SHP-32 | Prepaid/recurring access, renewal recovery/cancel, reviews, Support and preferences preserve their owner contracts |
| 6 — Cross-cutting completion | SHP-33–SHP-34, plus unresolved earlier modes | Local/remote isolation/outage and public accessibility/JS-disabled evidence complete; companion disagreements resolved |

A blocked provider or missing fixture blocks the affected activity/mode only. Continue independent activities while
recording the prerequisite. No wave can be marked complete from this documentation batch or from a test's existence.

## 3. Screen and surface inventory

Inventory baseline: **30 Shop XML screen definitions**, including the root and folder screens; no static Shared
subscreen mounts are declared in this tree. The following physical paths are relative to `screen/Shop.xml` and
`screen/Shop/`. Public paths use `B`, the resolved mount base (`''` for root or `/shop` in the common prefix example).
Physical XML paths are not a promise that every corresponding URL is a menu destination.

### Local routes and their actual entry points

| Source definition | Public entry, defaults and purpose | Activity mapping |
| --- | --- | --- |
| `Shop.xml` | `B/`, defaults Home; context check, full-document/shell decision and media/output transitions | SHP-01, SHP-06–SHP-08, SHP-33 |
| `Home.xml` | `B/` or `B/Home`; featured products/category entry and navigation | SHP-01, SHP-02, SHP-06 |
| `Categories.xml` | `B/Categories`, defaults List | SHP-02 |
| `Categories/List.xml` | Category tree from current public products | SHP-02 |
| `Categories/CategoryDetail.xml` | `B/categories/{id}/{slug}`; stable ID with optional decorative slug | SHP-02, SHP-05 |
| `Products.xml` | Folder defaults ProductDetail, requires actual product context | SHP-04; supporting direct-context refusal inspection |
| `Products/ProductDetail.xml` | `B/products/{id}/{slug}`; image, description, price/availability, trusted purchase | SHP-04, SHP-07, SHP-09, SHP-30 |
| `Search.xml` | `B/Search`; public product/page search, query and empty/unavailable state | SHP-03 |
| `Page.xml` | `B/pages/{routePath}`; published body/version, not the draft | SHP-05 |
| `Purchase.xml` | Hidden supporting screen; `/Purchase/quote` JSON and `Purchase.qvue` enhancement, not a browse page | SHP-04, SHP-09, SHP-34 |
| `Cart.xml` | `B/Cart`; lines, totals, codes and checkout | SHP-09–SHP-12 |
| `Checkout.xml` | `B/Checkout`; contact, address, delivery, payment and review steps | SHP-13–SHP-17, SHP-26, SHP-27 |
| `PaymentRelay.xml` | `B/PaymentRelay?ref=`; fresh hosted form token and Continue fallback | SHP-16 |
| `PaymentResult.xml` | `B/PaymentResult?ref=`; pending/unknown/placement pending/resolved state | SHP-16, SHP-17 |
| `OrderConfirmation.xml` | `B/OrderConfirmation?ref=`; completed checkout's order and next actions | SHP-18, SHP-19 |
| `Orders.xml` | `B/Orders`, defaults OrderList; reorder transition | SHP-20, SHP-21 |
| `Orders/OrderList.xml` | Buyer orders and cursor continuation | SHP-20 |
| `Orders/OrderDetail.xml` | `B/Orders/{orderId}`; lines, totals, payments, shipments, documents and Support | SHP-19–SHP-21, SHP-25, SHP-31 |
| `Orders/Status.xml` | `B/Orders/Status?token=`; accepts emailed capability, stores in session and cleans URL | SHP-19 |
| `Orders/Document.xml` | `B/Orders/Document?orderId=&invoiceId=`; scoped HTML invoice, optional Billing link | SHP-21 |
| `Account.xml` | `B/Account`; store purchase hub and links, distinct from `/account/Home` | SHP-20, SHP-32 |
| `Addresses.xml` | `B/Addresses`; add/change/end the verified buyer's addresses | SHP-22 |
| `PaymentMethods.xml` | `B/PaymentMethods`; masked cards, hosted add, affected-renewal confirmation | SHP-23, SHP-29 |
| `MethodRelay.xml` | Top-level `B/MethodRelay` consumes the session-saved hosted profile form and provides manual Continue. `PaymentMethods/add` actually emits `B/PaymentMethods/relay`; no alias exists in RouteServices and the provider CSP applies only to `/MethodRelay`. Static route concern, not an observed live defect | SHP-23 |
| `Downloads.xml` | `B/Downloads`; own or guest-authorized grants and ranged file transition | SHP-24, SHP-25 |
| `Subscriptions.xml` | `B/Subscriptions`, defaults SubscriptionList; purchase/method/cancel/resume transitions | SHP-26–SHP-29 |
| `Subscriptions/SubscriptionList.xml` | Contracts, attention state and configured Subscribe offers | SHP-26, SHP-27 |
| `Subscriptions/SubscriptionDetail.xml` | `B/Subscriptions/{contractId}`; access/billing state, history and permitted forms | SHP-26, SHP-28, SHP-29 |
| `Review.xml` | `B/Review?productId=`; approved reviews, eligible buyer submit/edit/photo form | SHP-30 |
| `Recover.xml` | `B/Recover?r=` then clean `B/Recover`; sign-in and explicit restore | SHP-12 |

Canonical product/category/page routes are lower-case; `Orders` and `Subscriptions` are capitalized as implemented.
The resolver validates stable IDs and bounded path/slug syntax, and excludes reserved order/subscription helper names
from the ID route. An old product/category slug redirects only after publication/access checks. Root Shop must not
consume Account, Billing, Support, framework authentication, REST, static, asset or other reserved paths.

### Transitions, embedded controls and supporting helpers

These are supporting surfaces, not additional menu pages. Inspect each with its mapped activity's starting context.

| Surface | Actual operation or UI contract | Activity mapping |
| --- | --- | --- |
| `Purchase/quote`, `Cart/quote` | Enhanced JSON quote versus plain Show price POST/redirect; neither adds an item | SHP-04, SHP-09 |
| `Cart/add`, `update`, `remove`, `applyCode`, `removeCode`, `state` | Same authority operations for forms/islands; first add creates capability, writes include operation identity/revision, state is private | SHP-09–SHP-11 |
| `Checkout/begin`, `contact`, `addresses`, `delivery`, `payment`, `submit`, `resume` | Ordinary forms, field error/notice, review revision, consent and deliberate submission/recovery | SHP-13–SHP-17, SHP-26–SHP-27 |
| `Checkout/return`, `Checkout/enhance`, `PaymentResult/state` | Canonical provider return exchanges reference/key, same-origin enhancement, private polling with backoff/manual check | SHP-16, SHP-17 |
| Checkout embedded sections | `CheckoutContact`, delivery/address/payment, review lines/totals, terms, `CheckoutOptIns`, recurring consent; no invented modal wizard | SHP-13–SHP-15, SHP-27 |
| `Orders/reorder` | Buy these again at current prices; unavailable lines named, no copied payment or placement | SHP-21 |
| `Addresses/store`, `Addresses/end` | Versioned save, carrier suggestion when supplied, explicit end confirmation | SHP-22 |
| `PaymentMethods/add`, `return`, `end` | Hosted setup, provider lookup, masked results and affected-contract confirmation | SHP-23, SHP-29 |
| `Downloads/file` | Issue short-lived grant capability, stream `getShopDownload` with browser range | SHP-24, SHP-25 |
| `Subscriptions/purchase`, `method`, `cancel`, `resume` | Start checkout, consented card change, confirmed renewal cancellation, failed-renewal retry | SHP-26–SHP-29 |
| `Review/submit`, review media on root `media` | Multipart review/photo changes, scan/moderation and digest-based publication | SHP-30 |
| `Recover/restore` | Explicit signed-in POST spends recovery token and rotates/reprices cart | SHP-12 |
| `Catalog.js`, `ShopCart.js`, `ShopCheckout.js` | View shaping, form/island wiring, redirect/status/cache behavior and session capabilities | SHP-02–SHP-18, SHP-34 |
| `ShopAccount.js`, `ShopSubscriptions.js`, `ShopReviews.js`, `ShopRecovery.js` | Account ownership, HTML forms, deliberate customer writes and refusal/re-entry | SHP-19–SHP-32 |
| `ShopTheme.js`, `ShopPreview.js`, `ShopFeeds.js` | Verified render package, preview-only host and active generation feed | SHP-06–SHP-08, SHP-33 |
| Shared PASS root, `Portal.js`, `Headers.js`, facade/transport | Brand shell, scoped error reasons, authentication/capability boundary and local/remote HTTP policy | SHP-01, SHP-19, SHP-31–SHP-34 |

### Theme packages, local templates, outputs and linked applications

The starter has **13 template JSON files**, one locked layout and 11 locked section templates. A file's existence
is not evidence that a current customer route selects that page kind. In particular `ShopAccount.js` and
`ShopSubscriptions.js` render their HTML through the trusted **checkout** page kind; the named account/order/download/
subscription templates remain package surfaces to inspect through theme validation/preview, not separate live routes.

| Surface family | Complete source inventory and inspection | Activity mapping |
| --- | --- | --- |
| Local HTML templates | `Catalog.html.fancy`, `Cart.html.fancy`, `CheckoutPage.html.fancy`, `Purchase.html.fancy`; full-document theme output or PASS shell fallback, hidden Purchase fallback copy | SHP-01–SHP-06, SHP-09, SHP-13, SHP-34 |
| Vue islands | `Purchase.qvue`, `Cart.qvue`; mounted by public webroot island support over trusted forms; loading/announced totals/stale errors and no session created merely by loading anonymous component source | SHP-04, SHP-09–SHP-11, SHP-34 |
| Package metadata/settings | `theme.json`, `config/settings.json`, `config/settings.schema.json`, `locales/en.json`; engine/view API, required components, typed settings and displayed text | SHP-06, SHP-34 |
| Layout | `layouts/store.html.fancy-locked`; document, brand/header/nav/footer, responsive and keyboard structure | SHP-01, SHP-02, SHP-06, SHP-34 |
| Live catalogue templates | `templates/home.json`, `category.json`, `product.json`, `search.json`, `page.json`, `not-found.json` | SHP-02–SHP-06 |
| Purchase templates | `templates/cart.json`, `checkout.json` and trusted `shop.productPurchase`, `shop.cart`, `shop.checkout`, `shop.search` components | SHP-04, SHP-09, SHP-13–SHP-18 |
| Additional package templates | `templates/order.json`, `account.json`, `orders.json`, `downloads.json`, `subscriptions.json`; explicit package/preview inspection, no assumed matching live selection | SHP-06; supporting inspection for SHP-19–SHP-29 |
| Locked sections and schemas | `hero`, `product-grid`, `product-main`, `category-main`, `page-content`, `search-results`, `rich-text`, `cart-main`, `checkout-main`, `account-main`, `not-found`, each `.html.fancy-locked` with its `.schema.json` | SHP-02–SHP-06, SHP-09, SHP-13, SHP-34 |
| Blocks and snippets | `blocks/text.html.fancy-locked` and `text.schema.json`; `snippets/product-card.html.fancy-locked`, `price.html.fancy-locked` | SHP-02, SHP-04, SHP-06, SHP-34 |
| Starter assets | `assets/store.css`, `logo.svg`; uploaded package images/fonts additionally served under digest-pinned theme asset route | SHP-06, SHP-07, SHP-34 |
| Theme assets | `B/theme/{manifestDigest}/{assetPath}` via `themeAsset`; active release only, verified bytes/type, long immutable cache, no traversal or arbitrary resource read | SHP-07 |
| Product/review media | Root `media?productContentId=&v=` or `media?reviewImage=`; current publication or approved scanned review image; no private storage URL exposure | SHP-07, SHP-30 |
| SEO outputs | `B/robots.txt`, `B/sitemap.xml`, canonical/hreflang links, product JSON-LD and search noindex | SHP-05, SHP-08 |
| Feeds | `B/feeds/{feedKey}.{xml,csv,json}`; only configured current active build/format, content type/digest and `no-store`; withdrawn or invalid build unavailable | SHP-08 |
| Purchase output | Confirmation HTML and QR of the signed-in order URL, not a bearer capability; scoped HTML invoice and optional Billing link | SHP-18, SHP-21 |
| Files | Short-lived protected download with filename/content type/range; no assumed ZIP/export bundle or ordinary public asset URL | SHP-24, SHP-25 |
| Provider forms | PaymentRelay obtains a fresh hosted token per visit. MethodRelay consumes the setup form saved in session once; its emitted nested redirect versus top-level route/CSP requires investigation. Both render manual Continue when reached with valid context; ordinary Shop pages retain their CSP | SHP-16, SHP-23 |
| Preview | Authority-runtime-only preview host/token page and token-scoped asset routes, editor selection annotations/allowed framing; no storefront login on that host, no draft preview on remote public frontend | SHP-06 |
| PASS Account | Mounted Account sign-in/registration/verification, `/account/Home`, `/account/EmailPreferences` including link/one-click flow | SHP-11, SHP-19, SHP-20, SHP-32 |
| PASS Support | Site's own question, request-return and request-cancellation forms linked with order context; signed-in permitted follow-up | SHP-31 |
| PASS Billing / staff apps | Optional scoped Billing links; Commerce order/cart/subscription/review evidence, Customer Service work, Warehouse movement and Accounting settlement | SHP-17, SHP-18, SHP-21, SHP-25, SHP-28–SHP-31 |

Shop has no local list-form XLSX declaration or inherited Shared descendants exporting spreadsheets. XML/CSV/JSON
feeds are generated catalogue outputs, not administrative list exports. A browser's Print action is not an implemented
invoice PDF service. Future requests for additional output formats belong to their owners after an observed need.

### Design-to-code reconciliation

| Historical/design surface or description | Current source disposition for this review |
| --- | --- |
| Initial Shop implementation introduction says work is not built | The 30 XML definitions, trusted helpers, starter, facade operations and registered checks are implemented; review them as pending live coverage |
| Design section/component names such as HomeSections, ProductPurchase, ReviewPurchase or OrderActions | They are composed sections/HTML from current helpers, not automatically separate routes or modal dialogs |
| Theme page kinds named for account/orders/downloads/subscriptions | The package supports their validation/preview; current after-purchase helpers select checkout as described above |
| “No checkout marketing opt-in until Marketing” | Current `optInFields` shows separately unchecked offered topics; source records consent through the current authority contract. Do not imply a completed Marketing suite or a default subscription |
| Guest order cancellation service in Shop | Current order page links Support's cancellation request; no direct cancel/refund control belongs to Shop |
| Themed Account / terminal PASS | Linked Account, Billing and Support keep branded PASS shell. A themed Account and PASS terminal UI remain later scope, not missing inventory rows |
| AcceptUI/embedded card form or second provider | Implemented first path is hosted redirect/relay; do not invent embedded card fields or claim Stripe support from future plans |
| Hosted profile relay described as a fresh-form route | `ShopAccount.addMethod` saves the returned form and redirects to `PaymentMethods/relay`, while `MethodRelay.xml` and the provider CSP are top-level. `relayPage` removes the saved form before rendering; it does not fetch a fresh token each visit. Track this static discrepancy in SHP-23, without declaring a reproduced defect |
| Wishlist, comparison, back-in-stock, quote-from-cart, semantic search, loyalty, advanced B2B, physical subscription boxes, proration/usage billing | No corresponding local Shop route is present; reconcile later-scope needs explicitly rather than fabricating activities for absent controls |
| Publishing app, theme marketplace, Liquid compatibility | Commerce currently owns theme/page authoring and publishing; a locked JS Fancy package is not a compatible Shopify/Liquid theme |
| Universal delivery-ledger claim | Download/renewal notices and jobs have ledger contracts; existing store order emails have their own sender history. Verify the particular notice's current sender/record, not a blanket “all mail uses one ledger” assertion |
| Broad “verified guest becomes account” statement | Email verification/claim moves access to the account; old emailed link refusal can direct the shopper to sign in. Possessing a link alone does not make an account |
| Source record marked fixed/later | A historical fixed item is a useful regression question; only current source and later evidence determine its present state. Accessibility beyond prior keyboard checks remains pending |

## 4. End-to-end activities

Each activity title states its objective; each is pending in every applicable mode. Steps describe a future review on isolated fixtures, including any
staff-side setup or observation coordinated with Commerce. Use visible controls first; a source/database inspection
confirms persisted results but does not replace the customer journey. Record exact route, actor, context and evidence.

### SHP-01 — Enter the right published store

**Actor and start:** Cookieless visitor; operator has prepared one root Shop and one prefixed Shop, their distinct
stores, Account/Support mounts and brand. Keep unpublished/disabled-mount variants available.

1. Open each canonical host at its actual Shop base; follow Home, Categories, Cart and account links.
2. Compare store identity, brand, navigation and empty/featured content with the selected ProductStore and release.
3. Follow Account and Support; return to Shop. Check reserved framework routes and the other site's host.
4. In the controlled fixture, disable publication or mount and request the same URL again.

**Expected visible/persisted result:** Correct store and mount context, no duplicate PASS shell around a themed document;
linked apps retain their own shell/path. Disabled/unpublished Shop is concealed. A visit creates no business record.
**Recovery:** Unknown host, wrong target or unavailable authority shows a bounded refusal/unavailable state; do not
silently fall back to another store. Confirm a valid no-release store's PASS-shell fallback separately.
**Modes:** H/J, N/D, L/R, P. Sources: Shop root, Pass, RouteServices, ShopContext, Deployment.

### SHP-02 — Browse categories and the public assortment

**Actor and start:** Visitor; nested browse categories with public products, an empty/private subtree and featured items.

1. Enter from Home's category/product navigation, open Categories and drill into a category.
2. Follow a product card, return using navigation/back, and continue any available pagination/sort controls.
3. Compare IDs/names/prices/images with the current published resolver output, including a virtual's visible variants.
4. Withdraw one fixture product and inspect its category, home and direct product entry after the documented cache window.

**Expected visible/persisted result:** Only currently public store products and usable category branches appear; breadcrumbs,
headings and selected context stay intelligible. Browse does not publish or mutate assortment.
**Recovery:** Empty category/search-style continuation has a clear way back; out-of-scope category IDs do not reveal another
store's tree. An old cached page cannot authorize a newly unavailable purchase.
**Modes:** H/J, N/D, L/R. Sources: Categories, Catalog, ShopCatalog, starter category/product-grid sections.

### SHP-03 — Find a product or page and recover from no results

**Actor and start:** Visitor; published products/pages with distinct titles plus a draft/private item and a long query.

1. Open Search, submit a product phrase and then a page title; follow a result and return to the retained query.
2. Try no matches, punctuation, a long bounded query, category/sort/cursor inputs actually offered by the current form.
3. Compare a signed-in customer's displayed offer with the anonymous result without exposing a price rule or another buyer.

**Expected visible/persisted result:** Public results, query and result state are understandable; draft pages/private products
stay absent. Search with a query carries its noindex behavior and has no business-write effect.
**Recovery:** Search unavailable is distinguishable from no match, with a usable browse route. Do not assume a semantic
search engine or advanced faceted UI absent from the trusted search form.
**Modes:** H/J, N/D, L/R, P. Sources: Search, Catalog, ShopTheme search component, ShopCatalog search.

### SHP-04 — Understand and price the exact selection

**Actor and start:** Visitor and verified buyer; simple, virtual/variant, digital, zero-price, unavailable-price and
quantity-sensitive fixtures; store-specific customer price and physical availability bands.

1. Open a public product through its canonical card. Read description, media, SKU, price/compare-at, availability and options.
2. Choose a variant and quantity; use Show price with H and the quote enhancement with J. Compare price and availability.
3. Try missing/invalid variant, zero/excess quantity, an excluded variant and an out-of-stock/unpriced item.
4. Repeat as the specific priced customer and another customer, keeping store/site fixed.

**Expected visible/persisted result:** Exact selection is explicit, quote and eventual cart use authority price, zero is
not “unavailable,” and inventory is a customer band rather than internal quantities. Quote alone does not add to cart.
**Recovery:** Error stays associated with selection; a changed/nonpublic product cannot be added by forging a displayed ID.
**Modes:** H/J, N/D, L/R, P. Sources: ProductDetail, Purchase/quote, Cart/quote, ShopCart, ShopCatalog.

### SHP-05 — Read the published page and follow stable URLs

**Actor and start:** Visitor; page/navigation draft differs from published version; old slug and explicit redirect fixture.

1. Follow header/footer navigation to the published page, including returns/terms when configured.
2. Compare title/body/navigation with the published revision, then inspect a newer staff draft without publishing it.
3. Request old product/category slug and a configured page redirect; request an unpublished/removed path.
4. Have the publisher release the page/navigation change, then revisit anonymously and with a session.

**Expected visible/persisted result:** Only published content is public; valid old slugs redirect to current canonical URL
following access checks, unavailable pages are 404, and generation changes correspond to publication rather than drafts.
**Recovery:** Broken/withdrawn content has a useful not-found route; no stale private content or open redirect is exposed.
**Modes:** H/J, N/D, L/R, P. Sources: Page, Catalog, RouteServices, Commerce website companion activities.

### SHP-06 — Observe theme preview, release and restore safely

**Actor and start:** Visitor with cart and signed-in buyer with an order; Commerce editor/publisher has draft, preview host,
active release and prior release. The reviewer follows staff work under the Commerce plan, not a new Shop editor.

1. Keep a live product/cart open while staff changes layout/settings/sections or uploads an asset in a draft.
2. Inspect authorized preview on its separate authority-runtime host, its marked selectable regions and token-scoped assets; ordinary login,
account and live storefront paths on that host must be unavailable.
3. Publish the validated release, reload public Home/product/page/cart/checkout and inspect active digest/generation.
4. Restore the earlier release; compare layout and current product/page publication without undoing the customer's state.

**Expected visible/persisted result:** Draft does not alter live pages; a complete verified release is rendered atomically.
Cart/order/subscription state remains authoritative and unchanged by release/restore. Package page kinds not selected by
live helpers receive a supporting validation/preview inspection rather than invented live navigation.
**Recovery:** Missing/corrupt/unsupported package yields safe unavailable behavior; an optional failed section may be omitted
with diagnostics. Verify these distinct cases; do not describe every section failure as whole-site failure.
**Modes:** H/J, N/D, L/R for live release/restore, P; draft preview on authority only. Sources: ShopTheme/ShopPreview,
starter, ThemeServices, Commerce theme activities.

### SHP-07 — Load only public, current media and theme assets

**Actor and start:** Visitor; current release assets, stale digest, public/unpublished product images and approved review photo.

1. Load the product/logo/style/images and inspect requested digest, type and response behavior.
2. Request stale/incorrect digest, invalid path, non-asset package file and unauthorized product media ID.
3. Advance publication generation or release and revisit current links; compare cached-byte behavior with a fresh request.
4. Inspect image alternative text, sizing, loading failure and no private storage/resource location in the page.

**Expected visible/persisted result:** Theme assets serve only current active manifest paths with verified bytes; immutable
cache means already-held bytes can remain in a browser, not that old-digest origin requests are authorized indefinitely.
Product image caching requires current generation; review image publication depends on moderation.
**Recovery:** Missing media does not expose diagnostics or arbitrary `file/http` resources; catalogue remains understandable.
**Modes:** H/J, N/D, L/R, P. Sources: root media/themeAsset, ShopTheme, ShopCatalog image access, ShopReviews.

### SHP-08 — Inspect discoverability and catalogue feeds

**Actor and start:** Visitor/feed consumer and Commerce operator; published catalogue/pages and active feed build.

1. Open robots.txt and sitemap.xml at both mount shapes; inspect canonical/hreflang and product structured data.
2. Open configured XML, CSV or JSON feed links using their actual key/extension; inspect content type, encoding, fields,
public URLs, price/currency, availability and digest against the staff build record.
3. Withdraw a product, replace a release or invalidate a feed generation; request stale/unknown feed paths again.

**Expected visible/persisted result:** SEO names only current public pages; structured offer matches the visible view.
Feed is a configured active build under current publication checks and `no-store`, not a live administrative list export.
**Recovery:** Missing/withdrawn feed returns unavailable/404 as appropriate; authority outage is distinct from no feed.
Record generation/cache timing without claiming a browser or CDN was observed during this authoring batch.
**Modes:** L/R, P, H/J for linked pages. Sources: Catalog robots/sitemap, ShopFeeds, RouteServices, Commerce feeds/reports.

### SHP-09 — Start a guest cart from a precise product choice

**Actor and start:** Cookieless guest on a published selectable product with no session cart.

1. Choose variant/quantity, show the price, then Add to cart; follow Cart and inspect line options, quantity and totals.
2. Add a second product from the same store; return through browser back and refresh without resubmitting accidentally.
3. Repeat the basic selection/add with JavaScript disabled; inspect component loading separately with a fresh visitor.

**Expected visible/persisted result:** First add creates the store's open-order cart and server-session capability;
no capability is exposed in browser URL, page markup or ordinary cookie. Form and island reach the same cart contract.
**Recovery:** Unpublished item, missing selection or rate-limited first add provides an actionable refusal; no false added
notice. Loading a public `.qvue` source alone must not create a customer cart/session.
**Modes:** H/J, N/D, L/R, P. Sources: Purchase, Cart, ShopCart, ShopCartServices.

### SHP-10 — Change a cart and understand promotions or stale edits

**Actor and start:** Guest or verified buyer with multiple lines, valid/invalid/exhausted promotion and two open cart tabs.

1. Update quantity, remove a line, apply a code and remove it using the visible forms/island controls.
2. Compare item, discount, shipping/tax and grand totals before and after; refresh and reopen Cart.
3. Submit a second tab's stale change and retry an operation with the same identity; change price/availability in a fixture.

**Expected visible/persisted result:** Authority reprices the same store cart, revision advances appropriately and repeated
operation is not duplicated. Invalid/exhausted/wrong-store code never grants a discount; stale mutation is refused clearly.
**Recovery:** Reload current cart, retain intelligible input/notice and reapply an intentional change. A stale quote or code
success does not guarantee final checkout eligibility; empty cart offers a way back to shopping.
**Modes:** H/J, N/D, L/R, P. Sources: Cart transitions, ShopCart, ShopCartServices, promotion authority.

### SHP-11 — Sign in, merge the proven cart and sign out

**Actor and start:** Guest cart plus verified account's existing cart in the same store; a second store/account for isolation.

1. Use the site's Account sign-in from the public journey; return to Shop and inspect merged lines/prices and notices.
2. Repeat navigation/reload or sign-in handoff; verify it does not merge twice or use an unproven cart ID.
3. Sign out, inspect Cart/back/history, then sign in as the second shopper and open the other store.

**Expected visible/persisted result:** The session's proven cart attaches/merges once, using current prices; account cart
capabilities rotate and sign-out drops frontend access. A default sign-in lands on the site's root app when configured.
**Recovery:** Failed login retains a usable route; expired or wrong-site cart capability gives no other buyer's contents.
Distinguish identity verification needed for purchase-history access from simply having signed in.
**Modes:** H/J, N/D, L/R, P. Sources: ShopCart signingIn/signingOut, PASS Account, ShopCart rules.

### SHP-12 — Deliberately recover an opted-in cart

**Actor and start:** Signed-in customer's eligible abandoned cart, cart-reminder consent, issued recovery email and second account.

1. Open the email's Recover link as a visitor; confirm token is removed from the address and sign-in is requested.
2. Sign in as owner, read the reprice notice and press Open my cart; inspect current lines, totals and unavailable-items notice.
3. Replay the link, use an expired/replaced link and open one as another account; inspect opted-out/guest eligibility at staff side.

**Expected visible/persisted result:** GET/mail-scanner navigation consumes nothing. Explicit authenticated restore spends
one recovery token, rotates capability and reprices the cart. Commerce recovery evidence agrees with that result.
**Recovery:** Invalid link gives a bounded unavailable page with normal Cart/continue-shopping links, not another cart.
No guest recovery promise or automatic promotion is inferred from the email flow.
**Modes:** H/J, N/D, L/R, P. Sources: Recover, ShopRecovery, ShopCart recovery, Commerce recovery settings.

### SHP-13 — Begin checkout and supply contact details

**Actor and start:** Guest and verified buyer with nonempty current cart, terms/contact settings and canonical host.

1. Press Cart's Check out; inspect the checkout's current line summary and contact section.
2. Save email/name and store-required contact fields; inspect completed step and retained values after reload.
3. Try invalid/required fields, missing cart, stale revision and a completed/expired checkout entry.

**Expected visible/persisted result:** Checkout refers to this cart/store; contact writes have visible confirmation and
field errors are associated/focused. Empty or completed state redirects appropriately; no order is placed by beginning.
**Recovery:** Correct input and retry deliberately without losing unrelated valid data; login can resume within identity rules.
No browser-supplied party/store/price becomes authoritative.
**Modes:** H/J, N/D, L/R, P. Sources: Checkout/begin/contact, ShopCheckout page/markInvalid, ShopCheckoutServices.

### SHP-14 — Choose the delivery address and available method

**Actor and start:** Physical and mixed cart, digital-only contrast, valid/invalid address and shipping options fixture.

1. Enter delivery/billing addresses, use Billing same only when intended and save.
2. If the carrier suggests a normalized address, inspect it and deliberately accept it; select an available delivery option.
3. Change address or contents and inspect refreshed delivery choices, totals and step completeness.

**Expected visible/persisted result:** Physical delivery fields/options match contents and configured service; digital-only
purchase does not demand fictional shipping. Selected method and cost persist only while valid for the current checkout.
**Recovery:** Unsupported address/no options/unavailable carrier has a clear next action, not a zero-shipping success.
Stale choices must be reviewed again. Saved-account address maintenance remains a separate customer operation.
**Modes:** H/J, N/D, L/R, P. Sources: Checkout/addresses/delivery, ShopCheckout addressFields, authority delivery quote.

### SHP-15 — Review the offer, payment choice and deliberate consents

**Actor and start:** Checkout with valid contact/delivery, hosted payment option, terms version and configured optional topics.

1. Choose payment and optional save-card only when offered; review items/options, price, discounts, delivery/tax and total.
2. Open current terms, accept deliberately and inspect optional-email boxes, initially unchecked and separately labelled.
3. Change price, inventory, promotion limit or terms between review and submit in an isolated fixture; submit once.
4. Include zero-total and unavailable-payment-configuration cases without assuming a card charge is necessary.

**Expected visible/persisted result:** Current authority offer/terms revision governs submission; changed offer becomes
reviewRequired with reasons before payment. Separate consent is recorded only as selected; guest consent may await
confirmation through the receipt link. Zero due can complete without a provider charge under the authority contract.
**Recovery:** Customer can review revised totals or fix missing prerequisites. No optional topic is required to buy;
recurring off-session consent is separately reviewed in SHP-27.
**Modes:** H/J, N/D, L/R, P. Sources: checkoutHtml/optInFields/submit, ShopCheckout freeze checks.

### SHP-16 — Pay through the hosted provider and return

**Actor and start:** Reviewed payable checkout, configured hosted gateway and canonical return host; test gateway first,
real sandbox only in a later explicitly authorized execution with its own evidence.

1. Press Place order and pay once; inspect PaymentResult's pending copy and Continue to the payment page.
2. Follow redirect or PaymentRelay; inspect automatic hosted POST and manual Continue with scripts disabled.
3. Complete or abandon the provider page, return through Checkout/return and inspect cleaned URL and authority outcome.
4. Refresh relay/result and return twice without editing provider parameters into a claimed successful payment.

**Expected visible/persisted result:** Authority freezes/commits attempt before gateway work; lookup determines result,
not browser callback text. Return key is retained only through supported session/return handling, never rendered as an
order capability. Only payment/profile relay CSP permits the configured hosted form destination.
**Recovery:** Pending remains pending; declined/cancelled result offers the supported back-to-checkout path. No-JS manual
Continue and Check again remain usable. Provider outage is not labelled customer decline.
**Modes:** H/J, N/D, L/R, P. Sources: PaymentRelay/Result, Checkout/return, ShopCheckout, provider adapter contract.

### SHP-17 — Recover payment uncertainty without another charge

**Actor and start:** Pending/unknown attempt, approved-but-unplaced checkout, and post-placement capture failure; staff
operator and treasury/resolver available with appropriate permissions.

1. Leave the provider/return journey, reopen PaymentResult, reload and use Check again while authority is unresolved.
2. Observe polling/backoff under J and manual refresh under H; retry/resume only where the visible state permits it.
3. Let the fixture provider/job resolve the same attempt; compare Commerce CartDetail and order payment evidence.
4. For stuck placement, have the authorized Commerce resolver place again or release/refund and cancel; for payment hold,
use Accounting's authorized release path, not a generic Commerce action.

**Expected visible/persisted result:** Unknown does not become decline or paid from elapsed time. Resume/duplicate submit
returns the unresolved attempt without a new charge; approved placementPending states payment separately from order.
A capture hold remains explicit after placement. Order/payment/attempt evidence agrees across apps.
**Recovery:** Keep reference and nonsecret evidence, give a bounded “check again/support” route; never manually recreate a
paid cart to hide uncertainty. Reconciliation continues even if Shop mount is later withdrawn.
**Modes:** H/J, N/D, L/R, P. Sources: ShopCheckout result/resume, ShopOperations, Commerce/Accounting companion handoffs.

### SHP-18 — Recognize confirmation and the next fulfillment step

**Actor and start:** Completed guest and verified checkout; physical/digital/mixed orders and a paid-but-not-placed contrast.
Also prepare a separate session holding only the completed checkout reference/return key, with no cart capability,
guest order capability or signed-in buyer identity; never include the key in captured evidence.

1. Follow successful result to OrderConfirmation; read order ID, lines, totals, contact, delivery/payment and next actions.
2. In the originating cart session, inspect the QR target, refresh confirmation and open order/download links as applicable.
3. Open the supported reference/key return path in the separate session and reach confirmation; compare its reduced
order status and email/sign-in guidance with the originating cart session, including absent personal/detail surfaces.
4. Compare the same order in Commerce, then relevant Warehouse and Accounting projections using their own actors.

**Expected visible/persisted result:** Only completed placement is confirmed; QR is a signed-in order URL without bearer
secret. One authoritative order/attempt is retained, with physical and digital state separately visible. Confirmation does
not imply shipment, invoice finalization, digital access before approval or settlement of a later return.
Reference/key-only access returns minimal confirmation: order identifier/status and guidance to use the emailed order
link or sign in, with no lines, contact details, QR, download links or newly issued order capability. Only the owning
cart/placed-cart path can issue the guest order capability, once; repeated confirmation reads do not mint another.
**Recovery:** PlacementPending stays in SHP-17, missing/expired session gives bounded re-entry, and refresh never places
another order. Guest link capability remains in server session for the specific order.
**Modes:** H/J, N/D, L/R, P. Sources: OrderConfirmation, PASS ShopCheckout confirmationHtml, Mantle ShopCheckout
confirmation access paths, Commerce operational evidence.

### SHP-19 — Open one guest order without expanding access

**Actor and start:** Guest confirmation capability and emailed `Orders/Status?token=` link, another order, expired token
and an account later claiming the purchase email.

1. Open emailed status link, inspect URL cleanup and the specific OrderDetail; reload/back and open linked documents.
2. Change order ID/site, attempt Orders list/account/subscription access and try a token lacking the required scope.
3. Register/verify the order email through Account, then retry the old guest link and sign in as the claimed buyer.

**Expected visible/persisted result:** `SalesOrder` / `OrderView` reaches its one order. Guest capabilities are session-kept,
not a general account identity; Download is a separate required scope for file access. Account claiming changes ownership
access and may require sign-in for the old link; no unrelated customer information is disclosed.
**Recovery:** Unavailable/expired/claimed link message provides an appropriate sign-in or Support continuation without
revealing another order's existence. Capability reads between frontend and authority use the defined POST contract.
**Modes:** H/J, N/D, L/R, P. Sources: Orders/Status, ShopAccount orderInput, ShopCustomer, authority capability lists.

### SHP-20 — Find one's purchases and move between account surfaces

**Actor and start:** Verified buyer with multiple orders, empty buyer, unverified buyer and same identity on two stores.

1. Open Shop Account, Orders, more-orders continuation and an OrderDetail through visible links.
2. Read item/payment/shipment/document states and follow allowed account hub/Billing/Support links.
3. Open the other store and compare order/customer context; sign out and retry a saved detail URL.

**Expected visible/persisted result:** Store purchases are filtered to authorized buyer/store; empty, pending and completed
states are useful. Shop `B/Account` is distinct from PASS `/account/Home`, whose cards link their own permitted apps.
**Recovery:** Unverified identity is directed to required account steps rather than shown history; another order or store
ID is refused equally. Visiting history does not mutate order status.
**Modes:** H/J, N/D, L/R, P. Sources: Account, Orders/List/Detail, ShopAccount, ShopCustomer.

### SHP-21 — Read a purchase document and buy again at today's offer

**Actor and start:** Own or authorized guest order with invoice, plus verified buyer with reorderable and unavailable lines.

1. Follow PurchaseDocuments to Orders/Document; check store/order/invoice IDs, date/status, lines and total.
2. Follow Billing only if the view offers it and verify its independent access rule. Inspect HTML readability/printing,
without assuming an implemented PDF, CSV or XLSX export.
3. As eligible buyer, press Buy these again and inspect the open cart, current prices and unavailable-item notice.

**Expected visible/persisted result:** Document is scoped HTML for the authorized order/invoice. Reorder makes/adds current
sellable lines to an open cart, copies no payment and does not place or charge it. Historical order remains unchanged.
**Recovery:** Missing/wrong invoice or inaccessible Billing is bounded; partial reorder names omissions and can be edited.
A guest order-view capability does not imply permission to perform account-only reorder.
**Modes:** H/J, N/D, L/R, P. Sources: Orders/Document/reorder, ShopAccount documentPage/reorder, ShopCustomer.

### SHP-22 — Maintain an owned address without changing another record

**Actor and start:** Verified buyer with an address, new address, carrier suggestion and stale revision in another tab.

1. Open Addresses, add a complete address, then expand/change an existing one and save.
2. Inspect returned normalized suggestion when available; choose deliberately rather than silently replacing input.
3. Confirm removal with Stop using this address; reopen and inspect checkout/address selection afterward.

**Expected visible/persisted result:** The buyer's versioned address is saved or ended with clear notices; ending does not
rewrite historical order shipment addresses. Another party's address ID cannot be edited.
**Recovery:** Invalid input, stale edit and carrier failure have correction/reload paths; unverified/anonymous entry cannot
write customer addresses. Record actual optional/required field policy, not a generic address form assumption.
**Modes:** H/J, N/D, L/R, P. Sources: Addresses/store/end, ShopAccount address forms, ShopCustomer.

### SHP-23 — Add or retire a masked payment method

**Actor and start:** Verified buyer, hosted-profile-capable gateway, existing card paying a recurring contract and second buyer.

1. Open PaymentMethods, inspect masked brand/last4/affected recurring orders and choose Add a card.
2. Follow the actual redirect emitted by Add a card. A provider `redirectUrl` goes directly there; the form response is
saved in session and currently emits `B/PaymentMethods/relay`. Record that route's result instead of silently replacing
it with top-level `B/MethodRelay`. The top-level XML/CSP mismatch is a static investigation input, not a completed journey.
3. Where the relay is reached with valid context, inspect its consumed saved form, manual Continue under H and provider
setup/return. Compare the card obtained through provider lookup, not browser input. Refresh/second visit or missing form
must return to PaymentMethods; it does not obtain a fresh form as checkout PaymentRelay does. If routing blocks setup,
record that branch blocked and distinguish any direct relay supporting inspection from the actual customer path.
4. Attempt removal, read affected contracts and complete the explicit confirmation; reopen the list/subscription detail.

**Expected visible/persisted result:** Site never collects raw card number/security code; owned masked method is stored once
through the hosted profile contract. Ending names consequences and does not silently transfer contracts to another card.
**Recovery:** Cancelled setup, missing provider support, duplicate return and authority outage leave explainable state;
wrong account method ID is refused. Consumed/missing saved form returns to the method list for deliberate restart.
Check the actual path's CSP: only top-level `/MethodRelay` has the profile-provider form-action exception, not the emitted
`/PaymentMethods/relay`. No application fix or live defect observation is part of this documentation correction.
**Modes:** H/J, N/D, L/R, P. Sources: PaymentMethods, MethodRelay, ShopAccount setup/relay/return/end, RouteServices,
Shared/Headers, ShopCustomer.

### SHP-24 — Download exactly the entitled file

**Actor and start:** Verified buyer and guest order with Download scope, current digital grant, versioned file and no-grant user.

1. Open Downloads from confirmation/order/account; read name, filename/version/size and availability state.
2. Use Download; inspect filename/type/bytes and a valid range/resume request through local and remote frontend.
3. Try another grant/order, expired short-lived file token and out-of-range request; inspect no-grant/ended access copy.

**Expected visible/persisted result:** `issueDownload` authorizes the grant and creates a ten-minute capability; frontend
streams bytes instead of exposing private storage. Valid range returns the corresponding 206/Content-Range contract;
invalid range is refused. Listing/streaming does not create a new fulfillment or widen guest access.
**Recovery:** Expired file capability can be reissued only while original entitlement remains valid; unavailable file has
an understandable return to Downloads/Support. Do not substitute a public asset URL to bypass a failed download.
**Modes:** H/J, N/D, L/R, P. Sources: Downloads/file, ShopAccount downloadFile, ShopFulfillment, facade ranged download.

### SHP-25 — Distinguish fulfillment, access and refund consequences

**Actor and start:** Physical, digital and mixed orders awaiting approval, approved, capture-held, delivered and refunded;
Warehouse/Customer Service/Accounting actors coordinate the corresponding owner actions.

1. Read each order's customer status and downloads before and after authorized approval/fulfillment work.
2. Compare shipment/tracking and digital receipt/access without treating one as proof of the other.
3. Process a fixture refund through Accounting and inspect the specific download/access source afterward.
4. Observe failed mail or interrupted fulfillment resumed by the owning job and resulting customer notice/status.

**Expected visible/persisted result:** Fulfillment starts from authorized approved state, invoices/grants are issued once,
refund revokes the affected source grant and unrelated/manual access survives. Physical return request/receipt/inspection
and financial settlement remain distinct. Customer communication names what actually completed.
**Recovery:** Payment hold or file/mail problem does not falsely report delivery. Retry resumes owner work without duplicate
invoice/grant; pending remains visible and the buyer can reach bounded Support.
**Modes:** H/J, N/D, L/R, P. Sources: OrderDetail, Downloads, ShopFulfillment/Operations, companion owner reviews.

### SHP-26 — Buy and extend prepaid access

**Actor and start:** Verified buyer, published prepaid offer/resource, no existing contract and a paid term with renewOffer.

1. Open Subscriptions, inspect price/term and prepaid label, then press Subscribe on the intended offer.
2. Complete the resulting Checkout and inspect subscription detail, paid-through/access state and order.
3. From an eligible contract use Buy another term; read the start-at-current-term-end statement and complete checkout.

**Expected visible/persisted result:** Purchase uses the standard authority checkout and fulfillment contract. Paid access
and term history are explicit; a prepaid extension starts at the defined boundary and creates no automatic renewal consent.
**Recovery:** Unverified visitor signs in/verifies; unavailable offer/stale contract/failed payment grants no access. Repeated
purchase submission does not duplicate a term. Do not invent proration or physical subscription-box controls.
**Modes:** H/J, N/D, L/R, P. Sources: Subscriptions/list/detail/purchase, ShopSubscriptions, ShopSubscriptionServices.

### SHP-27 — Subscribe with explicit recurring consent

**Actor and start:** Verified buyer, configured recurring offer/terms, hosted gateway capable of kept-card off-session charge.

1. Open Subscriptions and choose the offer; inspect renews-until-cancel wording, price, interval and terms version.
2. At Checkout select supported payment/save-method behavior and read the separate required renewal consent.
3. Try submission without consent, then deliberately consent and pay; inspect contract, method mask, paid-through and access.

**Expected visible/persisted result:** Current amount/term/terms and off-session consent are retained by authority; successful
paid fulfillment creates the contract/access exactly once. Optional marketing consent remains separate and unchecked.
**Recovery:** Unsupported gateway, missing method, changed offer or declined checkout grants no premature subscription;
uncertain payment follows SHP-17. Guest checkout does not silently create account-only recurring authority.
**Modes:** H/J, N/D, L/R, P. Sources: ShopSubscriptions purchase, ShopCheckout recurringFields, subscription authority.

### SHP-28 — Understand and resolve a failed renewal

**Actor and start:** Existing recurring contract with due, declined and unresolved occurrences; authorized operator and jobs.

1. Open Subscriptions attention state and contract History; read period, order, amount, state and next retry when present.
2. For an eligible failed occurrence choose Try the payment again; compare customer result and Commerce subscription evidence.
3. Repeat or overlap a scheduled retry in a controlled fixture; separately observe unresolved provider state.

**Expected visible/persisted result:** One occurrence/order/charge per period; failure extends no unpaid access and does not
turn into an unrelated receivable/Dunning success. A genuinely unresolved payment is reconciled before a new charge.
**Recovery:** Explain needed card/authorization change and next retry; unknown remains unknown. Staff retry has its own
permission and unresolved-attempt guard. Notice retry does not prove mail delivery or successful payment.
**Modes:** H/J, N/D, L/R, P. Sources: SubscriptionDetail/resume, ShopSubscriptions, renewal services/jobs, Commerce.

### SHP-29 — Change the renewal card or stop future renewal

**Actor and start:** Verified contract owner with multiple owned methods, paid term, pending renewal contrast and manual grant.

1. Open contract, select an owned card, read renewed-charge consent and use Use this card.
2. Try stale revision/other-owner method, then reload current state. Inspect history and actual method mask.
3. Choose Cancel renewal, read access-through date, optional reason and explicit Stop renewing checkbox; confirm.
4. Reopen contract and entitled resource before/after paid-through boundary or a separately authorized refund.

**Expected visible/persisted result:** Method change is consented/versioned; cancellation stops future renewal while paid-term
access remains. It is not a refund. Refunding one paid term affects its source; manual or another valid grant is preserved.
**Recovery:** Already-ended/stale/in-flight state is clear; cancellation never implies a completed charge can be erased.
Card end consequences in SHP-23 agree with this contract's next action.
**Modes:** H/J, N/D, L/R, P. Sources: Subscriptions/method/cancel, ShopSubscriptions, ShopSubscriptionServices.

### SHP-30 — Submit, moderate and revise a product review

**Actor and start:** Verified buyer with arrived purchase, nonbuyer/unverified visitor, public product, scanner and moderator.

1. Open Review from product context; inspect approved summary/distribution, author label, pagination, replies and images.
2. As eligible buyer submit rating/text/name choice and up to three photos; inspect own pending status and public view.
3. Have Commerce moderator approve/reply/reject as appropriate; inspect public outcome, then edit own review/remove photo.
4. Try nonbuyer/product-store mismatch, invalid/oversize/scan-failed photo and stale own-review revision.

**Expected visible/persisted result:** Authority finds purchase proof; shopper cannot choose arbitrary proof order. Only
approved content/scanned images are public; editing returns to moderation and author display choice is respected.
**Recovery:** Partial photo failure does not fabricate an all-saved outcome; inspect current review/revision and retained
files before retry. Withdrawn product/image is unavailable; no private media path leaks.
**Modes:** H/J, N/D, L/R, P. Sources: Review, ShopReviews, product review authority, Commerce moderation.

### SHP-31 — Ask for help, cancellation or a return within order scope

**Actor and start:** Verified order owner and guest with one `OrderView` capability; site Support mount targets store organization.

1. From OrderDetail use Ask a question, Request a return and Request cancellation on eligible fixture orders.
2. Check order/context retained on each Support form; submit the bounded request and read the receipt/state notice.
3. Compare Customer Service case/return/cancel proposal and Commerce read-only context; follow signed-in permitted tracking.
4. As guest, attempt unrelated order/context and broad MyCases/MyReturns/detail entry; as staff, distinguish internal note
from customer reply and actual Customer Service resolution.

**Expected visible/persisted result:** Requests reach the right organization/order and return receipts, not promises that a
return is authorized, stock received, order cancelled or refund settled. Guest one-order submission grants no general
case/return read access. Customer Service, Warehouse and Accounting own later authorization/receipt/settlement.
**Recovery:** Missing Support mount/readiness or ineligible request explains the next route; wrong-order capability is
refused without disclosure. Shop does not implement a duplicate cancellation service.
**Modes:** H/J, N/D, L/R, P. Sources: ShopAccount order actions, Support forms/helper, Customer Service/Mantle contracts.

### SHP-32 — Manage identity and email choices from the purchase journey

**Actor and start:** Guest purchasing email, unverified/verified account, store-reminder consent and optional list topic.

1. Follow My account/sign-in/registration/verification from the Shop context and return to the correct site/root app.
2. Open PASS Account Home and EmailPreferences; inspect store cart reminders and supported list-link/one-click behavior.
3. Enable/disable only intended topics, compare checkout opt-in choices and verify eligible recovery later uses current consent.
4. Inspect order-claim behavior after verification and sign-out across two stores on the same account.

**Expected visible/persisted result:** One verified identity reaches owned orders; preferences are explicit and store/topic
specific. Guest opt-in confirmation does not grant purchase-history access; guest order capability does not grant account
preferences. Linked Account stays in PASS shell with site brand, not the Shop theme layout.
**Recovery:** Expired verification/preference link and wrong account have bounded responses; no GET email scanner action
silently submits consent. Record actual sender and confirmation record, not assumed Marketing functionality.
**Modes:** H/J, N/D, L/R, P. Sources: PASS Account, ShopCustomer, checkout opt-ins and recovery contracts.

### SHP-33 — Preserve isolation and recover from authority or job outage

**Actor and start:** Two stores, two customers, guest capabilities, local authority and registered remote frontend;
controlled authority unavailability and paused/failed job fixtures.

1. Repeat representative catalogue/cart/checkout/order/download/subscription/Support requests across site, account and ID changes.
2. Compare local/remote successes and typed reason/field refusals, capability POSTs and deployment/session checks.
3. Make remote authority unavailable after cached catalogue/site information exists; inspect public and personal responses.
4. Restore authority and reconcile the same unresolved checkout/job item; compare Store readiness and authorized operational evidence.

**Expected visible/persisted result:** Remote frontend does not select arbitrary store/party or read local business entities.
No cached response is served when authority generation cannot be obtained under the implemented freshness checks; personal
pages stay no-store. One independent job failure is named without abandoning unrelated items or duplicating completed work.
**Recovery:** Safe unavailable/refusal copy retains legitimate retry/re-entry; no cross-store fallback or invented charge.
Withdrawal does not delete orders or stop reconciliation. Keep provider, frontend, authority and owner-job faults distinct.
**Modes:** H/J, L/R, P; N/D on representative failure pages. Sources: facade/transport/authority, ShopOperations, headers.

### SHP-34 — Complete the public usability and no-JavaScript pass

**Actor and start:** Visitor and buyer through public, cart, checkout, result and account journeys, starter and shell fallback;
keyboard, assistive-technology and real-device prerequisites recorded.

1. Repeat selection/Show price/Add, cart edit/code, checkout forms, relay Continue, result Check again and account forms with JS off.
2. With JS on, inspect island loading, live totals, stale/refused changes, polling backoff and focus after redirects/errors.
3. At 1920×1080, selected 1280 px and 390 px layouts and actual 200% browser zoom, inspect long names/addresses/tables,
dialogs from linked owners, touch targets, heading/landmark order, skip navigation, labels/required/error descriptions
and reduced motion. Measure 4.5:1 ordinary-text contrast, 3:1 qualifying large text and 3:1 meaningful controls/state.
4. Compare actual supplied light/dark theme/shell variants, themed Shop, branded Account/Support/Billing and no-release
fallback; do not invent a Shop toggle. Follow Back/reload across a release change and record viewport/zoom/theme evidence.

**Expected visible/persisted result:** Supported tasks remain possible through ordinary forms; enhancement adds timely feedback
without obscuring state. No important action exists only on hover, color or animation; no horizontal page overflow or
lost keyboard focus conceals the next step. Customer state and ownership do not change with viewport or renderer.
**Recovery:** Log concrete affected route/template/device and reproduction, including a blocked assistive technology check.
Existing 390 px/keyboard assertions are useful starting evidence, not a complete accessibility or device audit.
**Modes:** H/J, N/D, L/R representative surfaces, P for cache/CSP. Sources: all local templates/islands, starter, PASS shell.

## 5. Verification map and future validation

This section records what current checked-in assertions establish in their fixture scope. No suite or browser was run
for this document. A historical Built/green note in `impl-shop.md` does not become current evidence or activity completion.

### Existing PASS checks

There are 12 `test/Shop/*.spec.js` files: 11 substantive specs and `ShopWalkFixtures`. Registration of the one golden
client is explicit in [test/client/suite.js](../test/client/suite.js); it provisions `ClientFixtures`, `PortalFixtures` and
`ShopWalkFixtures` under `MoquiLoadTestConf.xml`. The current [budget](../test/budget) is server 20 seconds/client 9 seconds;
the repository's per-spec regression ceiling still applies. These numbers do not authorize a budget change.

| Regression source | Actual checked scope and practical limit | Activities |
| --- | --- | --- |
| [ShopAccess](../test/Shop/ShopAccess.spec.js) | Operator-only internal-store mount, one root/Shop, root reserved routes, concealed unpublished site, brand/context and local/remote reason parity; controlled source/render fixtures, not DNS/proxy deployment | SHP-01, SHP-33 |
| [ShopThemes](../test/Shop/ShopThemes.spec.js) | Starter validation/page kinds/required components, whole-document Home and asset digest/type, optional failing section omitted, remote verified files and safe unavailable mismatch; not every custom theme/device | SHP-06, SHP-07 |
| [ShopCatalog](../test/Shop/ShopCatalog.spec.js) | One render per catalogue page kind with only public products; anonymous one-minute policy versus session no-store and remote generation cache; not exhaustive SEO/index-provider behavior | SHP-02–SHP-05, SHP-08 |
| [ShopCart](../test/Shop/ShopCart.spec.js) | Theme cart/island without capability disclosure, token-write list/local-remote results, sign-in attach/sign-out drop, recovery page and explicit POST; no complete device walk | SHP-09–SHP-12 |
| [ShopCheckout](../test/Shop/ShopCheckout.spec.js) | Trusted themed checkout sections, relay-only provider CSP, capability operation classification/local-remote submit/refusal/return, root-app sign-in and error focus/description; not real provider behavior | SHP-13–SHP-18, SHP-34 |
| [ShopAccount](../test/Shop/ShopAccount.spec.js) | One guest order local/remote with other-order refusal, URL cleanup/session link, Support/download links and range streaming, verified hub/email preferences, capability POST lists and relay policies | SHP-19–SHP-25, SHP-31–SHP-32 |
| [ShopSubscriptions](../test/Shop/ShopSubscriptions.spec.js) | Shop offer URL, buyer list/detail separating billing/access and visitor sign-in, mirrored account-owned operations and checkout consent; full lifecycle belongs to authority/scenarios | SHP-26–SHP-29 |
| [ShopReviews](../test/Shop/ShopReviews.spec.js) | Approved scanned photo public locally/remotely, digest serving only after approval, eligible review/edit form and operation route types; not production scanner or moderation usability | SHP-30 |
| [ShopPreview](../test/Shop/ShopPreview.spec.js) | Preview host segregation, marked draft/allowed BOSS framing, binary upload served preview/live, digest/type pin validation including extension case; not arbitrary production theme correctness | SHP-06–SHP-07 |
| [ShopFeeds](../test/Shop/ShopFeeds.spec.js) | Feed routing/current active content local/remote and withdrawal refusal; no external merchant ingestion verification | SHP-08 |
| [ShopOperations](../test/Shop/ShopOperations.spec.js) | Generation-keyed visitor site info and unavailable-authority refusal to serve kept state; controlled call, not full distributed outage | SHP-33 |
| [ShopWalkFixtures](../test/Shop/ShopWalkFixtures.spec.js) | Provisions one no-theme digital guide/test hosted gateway on PASS_HTTP; fixture assertion confirms mount, not checkout result | Setup for SHP-09, SHP-13–SHP-18 |
| [ShopCheckoutWalk](../test/client/Shop/ShopCheckoutWalk.spec.js) | Single guest digital purchase at 390×844, contact/payment/hosted test return, confirmation totals/email, no return key URL, QR, no horizontal overflow and cookieless public Purchase.qvue; no physical delivery or real gateway | SHP-09, SHP-13, SHP-15–SHP-18, SHP-34 |

[acceptance/client/suite.js](../acceptance/client/suite.js) explicitly registers six Shop clients with
`ClientFixtures`, `PortalFixtures`, `SupplierPortalFixtures`, `SupportFixtures`, `ShopFixtures`. A registered remote
spec still needs its dedicated frontend/authority prerequisites; an ignored conditional feature is not remote evidence.

| Acceptance source | Actual scenario/assertion coverage and dependency | Activities |
| --- | --- | --- |
| [ShopFixtures](../acceptance/ShopFixtures.spec.js) | Creates two demo sites/stores if BOSS demo is absent, publishes products/theme/returns/terms, separate shopper carts and test/exception gateways; setup, not an independent customer walkthrough | All dependent scenarios |
| [ShopRemoteFixtures](../acceptance/ShopRemoteFixtures.spec.js) | Dedicated remote runtime requires `pass_backend_url`, asserts no Mantle catalogue and reads authority sites; ignored without that runtime | SHP-33 |
| [ShopMount](../acceptance/ShopMount.spec.js) | Root Shop mount preserves other app paths; visitor/remote context and refusal reason | SHP-01 |
| [ShopThemeRelease](../acceptance/ShopThemeRelease.spec.js) | Starter publication/render, infinite optional section bounded, `ec` template rejected with location, remote digest check | SHP-06–SHP-07 |
| [ShopPaymentScenarios](../acceptance/ShopPaymentScenarios.spec.js) | Changed-price review and repeated submit local/remote, unknown refresh/provider reconciliation, capture hold and authorized release, approved-but-unplaced resolver | SHP-15–SHP-18 |
| [ShopOrderScenarios](../acceptance/ShopOrderScenarios.spec.js) | Mixed physical/digital order, paid digital invoice/download, one-order guest Support request/cancel proposal, verified claim versus unverified, hosted card/address and refund revocation | SHP-18–SHP-25, SHP-31–SHP-32 |
| [ShopOrdersInCommerce](../acceptance/ShopOrdersInCommerce.spec.js) | Scenario records visible in Commerce/Warehouse/Accounting, requests/returns/cancel context, operator cannot release payment hold, current-price no-payment reorder and screen opens; requires BOSS and preceding scenario records | SHP-17–SHP-18, SHP-21, SHP-25, SHP-31 |
| [ShopSubscriptionScenarios](../acceptance/ShopSubscriptionScenarios.spec.js) | Consent/access, retried job charges once, decline extends nothing/leaves no Dunning amount, cancel keeps term and refund preserves manual grant | SHP-26–SHP-29 |
| [ShopSubscriptionsInCommerce](../acceptance/ShopSubscriptionsInCommerce.spec.js) | Staff contract screens, failed occurrence retry once, cancellation retains paid term and source-specific refund; requires BOSS/related subscription fixtures | SHP-27–SHP-29 |
| [ShopOperationsScenarios](../acceptance/ShopOperationsScenarios.spec.js) | Adoption proposal read-only until publisher, withdrawal leaves orders and job finishes attempt, remote unavailable authority serves no kept/personal page | SHP-01, SHP-06, SHP-17, SHP-33 |
| [ShopHttp](../acceptance/client/ShopHttp.spec.js) | Phone catalogue/page browsing, desktop other-store isolation/shell, JS-off selection/old slug/private refusal, cookieless public/304 versus session no-store | SHP-01–SHP-05, SHP-09, SHP-34 |
| [ShopRemoteHttp](../acceptance/client/ShopRemoteHttp.spec.js) | Two-store remote publication isolation and cookieless cache/304 | SHP-01–SHP-05, SHP-33 |
| [ShopCartHttp](../acceptance/client/ShopCartHttp.spec.js) | Phone islands, TEST2 promotion and sign-in cart merge | SHP-09–SHP-11 |
| [ShopCartRemoteHttp](../acceptance/client/ShopCartRemoteHttp.spec.js) | Remote add/code, two-tab stale refusal, one merge and sign-out drop | SHP-09–SHP-11, SHP-33 |
| [ShopCheckoutHttp](../acceptance/client/ShopCheckoutHttp.spec.js) | Physical guest checkout through test hosted return at phone width | SHP-13–SHP-18 |
| [ShopAccessibilityHttp](../acceptance/client/ShopAccessibilityHttp.spec.js) | Keyboard phone purchase, announced totals and focused/described refusal; reduced motion; JS-off price/add; account/digital 390 px overflow checks | SHP-04, SHP-09, SHP-13–SHP-18, SHP-20–SHP-29, SHP-34 |

### Authority and neighboring checks

These source suites substantiate business rules below the UI; they do not establish that every route displays them
well. Follow exact current assertions when selecting a future focused regression, rather than adding redundant renders.

| Current source | Relevant assertions or owner contract | UI questions still pending |
| --- | --- | --- |
| [Mantle ShopCatalog](../../mr-mantle/test/product/ShopCatalog.spec.js) | Public products/live exact page version, zero/unavailable/store/customer prices, variant feature extras and publication-safe images | Does each offer/error/stock band read clearly on the actual theme? |
| [Mantle ShopCart](../../mr-mantle/test/order/ShopCart.spec.js) | First-add capability, rejected client price/customer/store/status, revisions/operation IDs/code scope, store/currency isolation, merge/sign-out and party merge | Are stale/conflicting cart and sign-in outcomes understandable? |
| [Mantle ShopCheckout](../../mr-mantle/test/order/ShopCheckout.spec.js) | Hosted return places once; mismatch hold/saved method; changed price; approved payment retained on changed order; unknown stays unknown/no new key/attempt; failed placement retry; promotion limit/zero due; unchecked opt-ins | Are uncertainty, reviewRequired, consent and paid-but-unplaced communicated without false completion? |
| [Mantle ShopCustomer](../../mr-mantle/test/party/ShopCustomer.spec.js) | Guest/verified owner reads, unverified refusal, current-price reorder/address ownership, hosted setup once/affected recurring method, cart reminder consent | Does every account/link entry preserve the same boundary? |
| [Mantle ShopSubscriptions](../../mr-mantle/test/product/ShopSubscriptions.spec.js) | Purchase/renewal/consent/access ownership, retry/cancel and source-specific refund, refund ending renewal, scoped offer edits, fulfillment/backstop/job batch fixes | Are access dates/history/current payment and possible actions clear to the buyer and staff? |
| [ThemeReleases](../../mr-mantle/test/public/ThemeReleases.spec.js), [ThemeAuthoring](../../mr-mantle/test/public/ThemeAuthoring.spec.js), [PassAuthority](../../mr-mantle/test/pass/PassAuthority.spec.js) | Authority-side release/authoring/transport rules complementary to PASS render/preview tests | Do published customer state, active asset generation and outage/refusal behavior agree end to end? |
| [Commerce review verification](../../mr-boss/plan/ui-review-commerce.md#5-existing-checks-and-future-verification) and [Customer Service review](../../mr-boss/plan/ui-review-customer-service.md) | Staff publication, stuck-placement/recovery/subscription evidence and case/return/cancel owner paths | Do actual staff changes produce the intended customer outcome, with capabilities and organization scope intact? |

### Remaining gaps and allowed future checks

The checked-in tests cover many rules and several journeys, but do not claim a complete theme/device/accessibility
review, every no-JS account/subscription/Support branch, production DNS/TLS/proxy/CDN behavior, real mail/scanner/provider
integration, long-lived interrupted payment recovery on customer devices, arbitrary custom themes, or current live state.
The preview host, publication/restore with retained cart, customer-price cache isolation, current feed ingestion and guest
scope boundaries deserve explicit future evidence even when underlying rules have regression assertions.

Follow the repository's current two-suite rules. A later application fix gets the focused regression spec for its rule
or bug; render a screen at most once per mode across regression, and a second mode only for a real custom variant.
Keep Shop's one golden client path. Full workflows, access/isolation walks, screen sweeps, browser/device and load/media
coverage belong in acceptance; at most one sweep per app per mode. Run acceptance only when the user asks or when an
acceptance test is added/changed, then follow the stated component rule. Do not move this review checklist wholesale
into regression, invent a Shop terminal sweep, raise budgets or introduce Node as a test dependency.

No tests are written or run in this documentation batch. A future implementation/commit session must reread building,
testing and application instructions and perform the required checks for that authorized scope; this plan does not
approve an acceptance run, runtime walkthrough, live provider charge or commit.

## 6. Running record

### Activity coverage ledger

`Pending` means no live result has been recorded in this review. A checked-in assertion or completed source review does
not change it. When executed, record date/revisions, fixture/actor/store/site, actual modes, evidence, findings and blocked
branches per row. Use partial/blocked honestly; keep an activity pending in modes that have not been reviewed.

| Activity | Planned coverage | Status | Evidence / findings |
| --- | --- | --- | --- |
| SHP-01 | Published store, mount and shell | Pending | None |
| SHP-02 | Category/public assortment | Pending | None |
| SHP-03 | Search and no-result recovery | Pending | None |
| SHP-04 | Selection, price and availability | Pending | None |
| SHP-05 | Published content and stable routes | Pending | None |
| SHP-06 | Preview/release/restore and state | Pending | None |
| SHP-07 | Current media/assets | Pending | None |
| SHP-08 | SEO/feed outputs | Pending | None |
| SHP-09 | Guest add and cart | Pending | None |
| SHP-10 | Cart edits/promotion/stale state | Pending | None |
| SHP-11 | Sign-in merge/sign-out | Pending | None |
| SHP-12 | Deliberate cart recovery | Pending | None |
| SHP-13 | Checkout/contact | Pending | None |
| SHP-14 | Address/delivery | Pending | None |
| SHP-15 | Review/payment/consent | Pending | None |
| SHP-16 | Hosted payment return | Pending | None |
| SHP-17 | Uncertainty and operational recovery | Pending | None |
| SHP-18 | Confirmation and fulfillment handoff | Pending | None |
| SHP-19 | One-order guest capability | Pending | None |
| SHP-20 | Verified purchase history/account | Pending | None |
| SHP-21 | Invoice HTML/reorder | Pending | None |
| SHP-22 | Owned addresses | Pending | None |
| SHP-23 | Hosted payment methods | Pending | None |
| SHP-24 | Protected/ranged download | Pending | None |
| SHP-25 | Fulfillment/refund/grant consequences | Pending | None |
| SHP-26 | Prepaid term and extension | Pending | None |
| SHP-27 | Recurring purchase/consent | Pending | None |
| SHP-28 | Failed/unresolved renewal | Pending | None |
| SHP-29 | Card change/cancel/access | Pending | None |
| SHP-30 | Review/photo moderation | Pending | None |
| SHP-31 | Bounded Support requests | Pending | None |
| SHP-32 | Identity/preferences | Pending | None |
| SHP-33 | Local/remote isolation/outage | Pending | None |
| SHP-34 | Public accessibility/no-JS | Pending | None |

### Findings register

No live findings have been opened. The first future finding is **SHP-UI-001**, followed by SHP-UI-002 and so on;
those are reserved sequence examples, not completed investigations. Do not reuse historical `F` numbers from
`impl-shop.md` as if they were observations from this review.

| ID | Activity / route / mode | Observed behavior and evidence | Expected behavior / source | Owner / severity | State and recheck |
| --- | --- | --- | --- | --- | --- |
| — | — | No live review executed | — | — | No findings opened |

Static investigation inputs remain separate: package page kinds versus live checkout-kind rendering; historical
implementation/Later prose versus current opt-ins; media/cache withdrawal timing; partial photo-write recovery;
preview-only host and inactive-digest behavior; profile setup's emitted nested relay versus top-level XML/CSP and consumed
session form; exact notice sender/ledger; and accessibility beyond the current 390 px
keyboard assertions. These are bounded questions in the activities, not observed defects or claims of missing code.

### Documentation-batch record

| Date | Work | Result and limit |
| --- | --- | --- |
| Nov 10, 2026 | Baseline supplied by coordinator | Clean framework `47cd8a827ef2ac4ccc76d2543276f1815c19d0cd`, BOSS `65affc144440f317642448a734828ee1c3b02732`, PASS `3bb823d3a31b853cb56f4dd7b862ee020c1a260d`, Mantle `10d3b8c1f2e2fca6b4d0525a26a5bcbf15a38dc3`; new companion files absent |
| Nov 10, 2026 | Dedicated Shop author | Static source research; inventoried 30 XML definitions, 13 package template kinds, helpers/output/mount boundaries and current test registrations/assertions; drafted SHP-01–SHP-34. No live evidence added |
| Nov 10, 2026 | Companion contract exchange | Compared publication independence, checkout uncertainty, source-specific grants, Support capabilities and Commerce owner permissions with coordinator/Commerce author; final reconciliation is recorded below |
| Nov 10, 2026 | Fresh independent reviewer and author corrections | Reviewer required four corrections: profile relay route/form lifetime, reference/key-only minimal confirmation, measurable viewport/zoom/contrast criteria, and disposable-runtime/lifecycle preparation. Author checked current sources and revised those sections. No live finding or application change |
| Nov 10, 2026 | Independent recheck passed | The same reviewer verified all four corrections against current sources and found no new contradictions in the revised sections. Independent review/recheck is complete; all 34 live activities remain pending |
| Nov 10, 2026 | Coordinator reconciliation and final checks passed | Compared both plans and current publication/offer/payment/access/identity/authority contracts with core-app owner boundaries; added reciprocal activity checkpoints. Read-only relative links/anchors, seven sections, activity/finding identifiers, inventory mappings, pending ledgers and whitespace passed. Only the two requested new documents changed; baseline revisions are unchanged. Both independent reviews/rechecks passed; no builds, runtimes, walkthroughs, tests or commits |

## 7. Decisions and completion boundaries

| Decision | Default and reason |
| --- | --- |
| Scope | Full implemented public Shop including physical, digital, prepaid and recurring journeys, plus concrete linked owner handoffs; no absent feature is invented to match a design name |
| Source authority | Current screens/helpers/services/fixtures/assertions take precedence over design/implementation historical status; comparison research is existing reference material only |
| Route notation | `B` is current mount base; preserve canonical lower-case catalogue routes and implemented capitalized account/order/subscription routes; no literal `/Shop` public-root assumption |
| Render modes | Public HTML H/J, narrow/desktop, local/remote and outputs. BOSS Material/Standard/TUI do not become Shop feature variants; no Shop TUI exists in scope |
| Theme ownership | Commerce authors/previews/publishes; Shop renders the verified active package. Linked Account/Billing/Support retain PASS shell. Restore does not republish withdrawn products/pages |
| Payment truth | Authority/provider lookup and retained attempt/order control outcome; elapsed time, callback query claims and UI retry do not establish paid/declined or authorize another charge |
| Identity and capabilities | Verified account, guest OrderView, Download and recovery capabilities have distinct scopes/lifetimes; one-order Support intake is receipt-only and grants no broad case/return read |
| Fulfillment/settlement | Warehouse controls physical work, Customer Service requests/authorization, Accounting holds/refunds/settlement, Mantle fulfillment/access; Shop displays customer projections and permitted requests |
| Subscriptions | Cancel stops renewal and retains paid term; not a refund. Card change needs consent, unresolved renewal must reconcile, and source-specific refund preserves unrelated access |
| Runtime independence | Published Shop works with PASS plus its local/remote Mantle authority, with no BOSS runtime dependency; remote frontend has no business entity catalogue |
| Outputs | Inspect actual HTML, feeds, media, SEO, provider forms, QR and protected files. No assumed invoice PDF, inherited list XLSX, ZIP bundle or generic export workflow |
| Review completion | Both documents need fresh independent review, required correction recheck, companion reconciliation and read-only documentation checks; source-authoring completion alone is insufficient |
| Live coverage | Every SHP activity remains Pending until a later explicitly scoped execution records evidence; documentation completion never authorizes acceptance, live provider work or a commit |

Remaining execution uncertainties are concrete: available deployment shape/transport and host policy; current store
fixture readiness; canonical gateway return and real sandbox access; scanner/private media/file support; mail sinks and
notice templates/senders; configured jobs and controllable failure cases; saved-method/off-session gateway support;
real device/screen-reader coverage; and custom theme/package behavior beyond the starter. Record each when a later
session resolves it, including cases blocked by missing provider, device or operator access.

Independent review/recheck and coordinator checks are complete for this documentation batch; all live coverage remains pending.
The intended later outcome is an evidence-backed usable public journey with the same offer, payment, access and support
boundaries the Commerce operator sees; that outcome is not asserted by this document's creation.
