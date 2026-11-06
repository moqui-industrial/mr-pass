# IronStone PASS — Shop implementation

Nov 5, 2026 — plan, before Shop starts. P0 partly done: F1–F34 found while writing it, F35–F36 from Customer Service's
finished code (§6); design-shop brought in line with them. The open questions shared with Commerce answered, and the
review of Nov 5 decided (impl-commerce §4; here §4). Customer Service is done; Shop is built with IronStone Commerce in
one build order, kept in [mr-boss impl-commerce.md](../../mr-boss/plan/impl-commerce.md) §1.

How [design-shop.md](design-shop.md) gets built, in phases from the app's mount to its operations, each ending tested
and usable. This file is kept at a high level, as mr-boss's
[impl-customer-service.md](../../mr-boss/plan/impl-customer-service.md) and
[impl-commerce.md](../../mr-boss/plan/impl-commerce.md) are: each phase names its scope by the design's sections and
§15 needs rather than restating them, and the design stays the place for page and record detail. During the build this
file is the log: phase status and what each built, the decisions made, findings against the code, and what is
deferred. The ground rules and the open questions Shop shares with Commerce are kept in impl-commerce §2 and §5.

Today mr-pass registers seven apps (Forum, Account, Members, Sites, Billing, Supplier and Customer Service's Support).
None of the design's Shop services, records or operations exist (F1–F34). Shop is built after Customer
Service, beside Commerce, on what is built:
- from PASS (design-forum, implementation-forum): sites with hosts and targeted app mounts, the root mount, public
  accounts with verification, recovery, second factor and SSO handoff, invitations, the facade with its operation
  catalogue and Mantle's PassApi and gRPC authority for a remote frontend, CSRF and throttling, media staging and
  scanning, readiness per app, the Forum's delivery and its entitlement handlers (`PublicAccessGrant`,
  `PublicSubscriptionBinding`, `expire#SubscriptionAccess`);
- from Accounting P18: the Billing app's hosted payment over `PortalPaymentAttempt`, ExternalAccess capabilities with
  token digests and invitations bound to an app, and the CX-POSTING operation record;
- from Mantle: open orders as carts, the price resolver, availability over a store's facilities, promotions, payment
  gateways with `operationKey` replay and the Authorize.Net and PayTrace adapters, Shippo address validation and rates,
  the tax gateway, `create#InvoiceFromSource`, subscriptions and recurring orders, consent and unsubscribe tokens;
- from Customer Service (built; impl-commerce F25, F37–F41): the Support app with RequestReturn and NewCustomerCase
  (its `cancelOrder` for an order), `SupportCaseServices.create#CustomerCase`,
  `ReturnPolicyServices.request#CustomerReturn`, `OrderChangeServices.request#CustomerCancel` (the `requestOrderCancel`
  operation), the ExternalAccess self relationship and the `support` app kind, `PortalMedia.js`, and the sales
  commercial revision flag;
- from Commerce, in the shared order: stores and readiness, publication, site pages and navigation, theme editors and
  preview, checkout settings, promotions, and the staff views of what Shop records.

**Inputs.**
- Designs:
  - [design-shop.md](design-shop.md)
  - [mr-boss design-commerce.md](../../mr-boss/plan/design-commerce.md): §4 publication, §5 authoring (the one
    definition of the staff editors), §6 the staff views, §8 checkout settings, §11 automation
  - [design-forum.md](design-forum.md): §1 (the public shell and mounts), §4 (deployment, the authority boundary and the
    request contract), §5 (identity), §8 (the PASS Account foundation and its hub), §13.1 (how an app registers),
    §13.2 (Shop: `subscriptionUrl` and paid access)
  - mr-boss [design-customer-service.md](../../mr-boss/plan/design-customer-service.md) §4 (customer cancellation) and
    §8 (the Support pages and their access)
  - mr-boss [design-crosscut.md](../../mr-boss/plan/design-crosscut.md) §1.3 (the automation register and Shop's
    conditions), §3.7 (availability bands), §5 and §5.1 (PASS rows, the account hub), §7 (CX-DELIVERY)
  - mr-boss [design-accounting.md](../../mr-boss/plan/design-accounting.md) AC-02 and Dunning;
    [design-sales.md](../../mr-boss/plan/design-sales.md) RecurringTemplate and SAL-RECURRENCE
- Plans:
  - [mr-boss impl-commerce.md](../../mr-boss/plan/impl-commerce.md): the order (§1), the shared ground rules (§2), the
    shared decisions and open questions (§4, §5).
  - [mr-boss impl-customer-service.md](../../mr-boss/plan/impl-customer-service.md): P10 (the customer cancel and the
    sales commercial revision), P13 and P15 (the Support app, its registration and the self relationship).
  - [mr-boss impl-accounting.md](../../mr-boss/plan/impl-accounting.md) P18 and §7 (chargebacks calling
    `reconcile#RefundedItem`).
  - [implementation-forum.md](implementation-forum.md), [Deployment](../docs/Deployment.md) and the README's development
    checks.
  - mr-mantle `plan/payments-shipping-edi.md` (F14).
- The suite-app design review, which explains the design's X and R-SHP IDs, was removed from mr-boss (bd74564); read it
  with `git show bd74564^:plan/review-suite-apps.md` in mr-boss.
- Guides and rules: mr-boss [design-doc-guide.md](../../mr-boss/plan/design-doc-guide.md), mr-boss
  [impl-drawers-commons.md](../../mr-boss/plan/impl-drawers-commons.md) §4, mr-moqui `docs/dev/Practices-App-Dev.md`.
- Inventories: mr-boss [usl-inventory.md](../../mr-boss/plan/usl-inventory.md), where the services the public facade
  calls are mapped with `PASS:` paths.

Framework paths are under the mr-moqui checkout (`crates/`, `runtime/base-component/`), Mantle paths under
`runtime/component/mr-mantle/`, BOSS paths under `runtime/component/mr-boss/`.

Sections: [1 scope](#1-scope-and-order) · [2 rules](#2-ground-rules) · [3 phases](#3-phases) ·
[4 decisions](#4-decisions) · [5 open](#5-open-questions) · [6 findings](#6-findings) · [7 later](#7-later) ·
[8 verification](#8-verification)

---

## 1. Scope and order

- **Repositories.** Each is its own git repo:
  - `mr-moqui` (`crates/`, `runtime/base-component`): the theme composition adapter and its budgets on the locked
    renderer (P2), and what the route cache policy needs of the public-site routing (P1, P3);
  - `runtime/component/mr-mantle`: Shop's Mantle services and records (design-shop §13.2's K, C, X, A, D and R) and the
    owners' contracts of §4;
  - `runtime/component/mr-pass`: the Shop app, the PASS Account hub and email preferences page (P6), the starter
    theme, and the Shop pieces of Commerce phases (impl-commerce §1: the preview host in its P5, review pages and images
    in P9, the recovery link in P10, the Shop-site feed destination in P14);
  - `runtime/component/mr-boss`: the Commerce phases (impl-commerce) and BOSS's grants of the permissions Shop's Mantle
    services seed.
- **Scope.**
  - Every Shop row of design-shop §2 and the §15 needs they use, as changed by §6 (F26, F27, F35).
  - The Support pages RequestReturn and NewCustomerCase (with its cancel request) linked from Shop's order pages with the
    order, on the site's own Support mount (§4, F35); Customer Service builds them, and the capability that admits a
    guest is the owner contract of P6.
  - The PASS Account hub and email preferences page (design-shop §2's AccountHub and EmailPreferences), built here as
    the PASS Account foundation's unless Customer Service P15 has (F6).
  - The owners' contracts Shop needs (impl-commerce §4): Accounting's typed payment-attempt coordinator, the
    `OhtPayment` hold and Dunning's renewal exclusion; Sales' RecurringTemplate marker and the recurring worker's skip;
    Comms' delivery ledger; ExternalAccess's `SalesOrder` kind; Customer Service's customer services admitting it.
  - §7 holds the design's later scope and §20 items, and the Marketing, Admin and Sales parts that wait for their owners.
- **Order.** impl-commerce §1 holds the one order of both apps. Shop's phases in it:
  - P1 App and mount, after Commerce P2 (it registers `check#StoreReadiness`), beside Commerce P3;
  - P2 Theme engine and releases, after Commerce P3;
  - P3 Catalog pages, after Commerce P4 (stage C1/S1 ends with Commerce P5);
  - P4 Cart and shopper identity, P5 Checkout and payment and P6 Orders, account and digital delivery, after Commerce
    P6 and P7, and before Commerce P8 and P9, which use their orders and ledger (stage C2/S2 ends with Commerce P11);
  - P7 Prepaid and recurring access (stage C3/S3 ends with Commerce P12);
  - P8 Adoption and operations, after Commerce P14 (stage C4/S4);
  - P9 Finish, with Commerce P15.

## 2. Ground rules

- **Commerce's rules hold** (impl-commerce §2): the Commons rules, service rows through services, staff and public
  apart, what Mantle runs is Mantle's, store records by the shared rules, one publication generation, restricted values
  on the server, revisions and operations on the CX-POSTING record, owner contracts, Mantle's defaults kept, and
  existing callers compatible.
- **PASS's foundation** (design-forum §1, §4, §5, §13.1):
  - Shop is a targeted app of PASS's public shell: its mount names a ProductStore, set by an operator; a site has at most
    one Shop mount.
  - Public accounts hold only `ALL_USERS`; no purchase, paid resource or role ever adds a UserGroup.
  - Pages reach the authority only through `pass.Facade.call#Operation`: each operation is in `Schema.js` and
    `Routes.js` with Mantle's mirrors, and the same pages work with a local Mantle or a remote authority with only
    framework, webroot and PASS installed. BOSS is not a runtime dependency: no `ironstone.*` service, BOSS screen or
    group is called.
- **The request contract** (design-shop §13.1): inputs allow-listed (never a store, organization, customer, price,
  status or adjustment from the browser); the trusted site, mount, store, actor and cart context come from the facade;
  answers are declared projections with capabilities and revisions, money and quantities as decimal strings with
  display text; opaque cursors and bounded pages; operation IDs on writes and `expectedRevision` on changes; the facade's
  error kinds with a camelCase `reason`, the same through a remote frontend (P1, F4).
- **Capabilities, not new tokens** (X6): a guest's order, download and renewal links are `SalesOrder` capabilities of
  ExternalAccess checked by `check#AccessCapability`; a cart's access is its StoreCartAccess on the same digest and
  throttle (F16); a link's write is in the three `TOKEN_WRITES` lists (F1).
- **Money and access are strict.** No gateway call inside an open transaction; no new provider key to escape an
  unknown outcome; access and downloads only after settlement; one logical order, payment, capture, invoice, grant and
  notice per event. Independent work still continues and names its failures: an optional theme section, a feed product,
  a delivery, a renewal, an adoption row.
- **Merchant source is sandboxed.** Themed pages render through the composition adapter in the locked renderer: theme
  source never reaches `ec`, services, entities, resources or the network; trusted components and data sources are
  operator-installed code.
- **Pages.** Discovery is server-rendered HTML usable without JavaScript; cart, checkout and account tasks are HTML forms
  with trusted Vue enhancement; every page works at 390 px. Public caching only for anonymous catalog and content
  routes, by generation; everything personal is `no-store`. PASS has no terminal UI; Commerce's editors have the twins.
- **Done for a phase** is impl-commerce §2's, with these for mr-pass:
  - the phase's rules in `ShopAccess` (local, and remote through the transport) where it adds an access rule, and in
    its own rule spec otherwise; the Mantle rules in mr-mantle's specs;
  - `moqui lint --screens` clean for PASS;
  - the Schema and Routes mirrors identical (Forum's spec) and Portals' registry parity (F1);
  - its row and **Built** note here.

  The phase's "usable when" is an acceptance test to write in mr-pass `acceptance/` (the browser walk on ForumHttp's
  pattern in `acceptance/client/`, the remote one on RemoteHttp's, the remote fixture on RemoteFixtures'); running it is
  not part of Done.

## 3. Phases

| Phase | Repos | Pages | Status |
| --- | --- | --- | --- |
| P0 Checks | all (read) | — | done Nov 5 (§6 F1–F45) |
| P1 App and mount | Mantle, mr-pass | the Shop root, the PASS shell on a Shop site | built Nov 5, 2026 |
| P2 Theme engine and releases | mr-moqui, Mantle, mr-pass | the starter theme's page kinds | built Nov 6, 2026 |
| P3 Catalog pages | Mantle, mr-pass | Home, Categories, CategoryDetail, Search, ProductDetail, Page | built Nov 6, 2026 |
| P4 Cart and shopper identity | Mantle, mr-pass | Cart, ProductDetail's purchase selection | built Nov 6, 2026 |
| P5 Checkout and payment | Mantle, mr-pass, BOSS (grants) | Checkout, PaymentResult, OrderConfirmation | built Nov 6, 2026 |
| P6 Orders, account and digital delivery | Mantle, mr-pass, BOSS (grants) | AccountOverview, Addresses, PaymentMethods, Orders, OrderDetail, RequestReturn, NewCustomerCase, Downloads; Account's hub and email preferences | built Nov 6, 2026 |
| P7 Prepaid and recurring access | Mantle, mr-pass | Subscriptions, SubscriptionDetail | — |
| P8 Adoption and operations | Mantle, mr-pass | — | — |
| P9 Finish | mr-pass | — | — |

### P0 — Checks

Verify the design's riskiest assumptions against the code before building. F1–F34 were found on Nov 5 while writing this
plan, and the design edits they call for were made then (§6). Customer Service's Support pieces and the sales
commercial revision were checked later on Nov 5, once Customer Service was done (F35, F36; impl-commerce F25,
F37–F41): the pages take the order by `orderId` and the actor by contact or self relationship, are bound to the site's
own Support mount, and admit no capability; the self relationship needs a current verified email; the media module is
`PortalMedia.js`; no Account hub or email preferences page was built (F6); the flag is
`salesCommercialRevisionOnly`, which leaves alone a part that has a customer party. The three below were checked later on Nov 5 (F37–F45):

- **Authorize.Net** (F14; Accept Hosted, impl-commerce §4): the hosted payment page request with its return options and the
  attempt's reference, saving a profile from it, the hosted profile page for adding a method outside checkout, the
  stored-credential and merchant-initiated fields of a profile charge, and the webhook events of each, against the
  current API reference.
- **The routing:** whether the public-site routing can give Shop's catalog routes their own cache headers, or Pass.xml
  sets them per app (F3); what a remote frontend needs to cache by generation; a cart capability as a token write
  without a member session, over REST and gRPC (F29).
- **Trusted Vue components on PASS:** the qvue enhancement the Forum's composer uses, as the pattern for purchase
  selection, cart, checkout and payment components under PASS's CSP.

### P1 — App and mount

Design-shop §1, §4.1 and §4.3's readiness; SHOP-MOUNT.

- **Registration** (F1): `shop` in `service/pass/Apps.js` (screen `Shop`, base `/shop`) and Mantle's `PublicApps.js`
  (target `productStore`: a real store whose organization is internal; readiness Commerce P2's
  `mantle.product.StoreAdminServices.check#StoreReadiness`, F34); `screen/Pass.xml`'s subscreens item; the Header's
  branches; `test/MoquiConf.xml`'s mounts; Portals' targeted-app assertion; the `TOKEN_WRITES` lists (empty for Shop
  until P4); `docs/Deployment.md`'s "Adding an app" (:221-228) corrected, with its "Access" note, which still says
  Commons and Comms are open to every user (since BOSS_USERS they are not).
- **The root** (F2): `root` for `shop` in PublicApps; `storeMounts` allows one root app per site, Forum or Shop; Mantle's
  reserved mount paths aligned with the framework's (`static`, `assets`, `sw.js`, `manifest.webmanifest`, `WebPush`
  added); `resolve#Route` for Shop's product, category and page paths. A Shop at `/` never captures Account, Forum, API,
  token, asset or operational routes.
- **The Shop root and shell** (F7): `screen/Shop.xml`, concealed until its site and mount are published; a themed app
  renders its own layout (P2), while Account, Billing and Support pages on a Shop site keep the PASS shell with the
  site's brand values read from `PublicSite.theme`; `getSiteInfo` returns the brand and `subscriptionUrl`.
- **Headers** (F3): Pass.xml's headers become per route, `no-store` by default; P3 opens public caching for the
  anonymous catalog routes.
- **Errors** (F4): the authority's error envelope carries an allow-listed camelCase `reason` and field errors, and
  Transport maps them back, so a remote page shows the same refusal as a local one (Purchasing F170 closed);
  `Shared/Portal.js` maps a reason to the page's text.
- **Context:** the `getShopContext` operation (site, store, locale, currency, the active release, capabilities).
- **Demo** (F33): the Shop mounts of the two PASS sites Commerce P1's demo service makes, disabled until published:
  ZIZI_SHOP (host `shop.zizi.localhost`) with Shop at `/` for POPC_DEFAULT, and ZIZI_DIGITAL (host
  `digital.zizi.localhost`) with Shop at `/shop` for BOSS_COM_DIGITAL, each beside its Account, Billing and Support
  mounts.
- **Specs:** mr-pass `test/Shop/ShopSpecLib.js` and `ShopAccess` (an unknown or another organization's store refused as
  a target, a second Shop mount and a root conflict refused, reserved paths kept, an unpublished site concealed, the
  context through the local adapter and the transport); Mantle `PassAuthority` (+1 feature: a reason through the
  envelope).
- **Usable when:** an operator mounts Shop at the root of ZIZI_SHOP for POPC_DEFAULT, and `/account`, `/billing`, the
  API, `/static` and token routes still reach their owners; readiness lists the store's findings; a remote frontend gets
  the same context, and a refused write shows its reason there.

- **Built, Nov 5, 2026** (mr-mantle and mr-pass, branch `shop/p1`):
  - Registration: `shop` in `service/pass/Apps.js` (screen `Shop`, base `/shop`) and Mantle's `PublicApps.js` (target
    `productStore`: a ProductStore whose organization has `OrgInternal`; `root: true`; `onePerSite: true`; readiness
    `mantle.product.StoreAdminServices.check#StoreReadiness` unchanged); `Pass.xml`'s Shop subscreen; the Header's Shop
    branch (nav "Shop", a Shop link on any page of a site with a Shop mount); `test/MoquiConf.xml`'s `/shop` mount;
    Portals' targeted apps `billing,shop,supplier,support`; a "Shop P1: none yet" line in the three `TOKEN_WRITES`
    lists; `getShopContext` in `Schema.js`/`Routes.js` (`GET shop/context`) and the mirrors; `Contracts.d.ts`
    (`ShopContext`, `SafeError.reason`, `MountInput` with every app and `targetId`). `docs/Deployment.md`: a Shop app
    section, "Adding an app" made complete (the places F1 lists, plus the reasons lists) and its Access note corrected
    (BOSS's roots are `BOSS_USERS`'), "one app per site may use `/`".
  - The root (Forum.js `storeMounts`): one root app per site, Forum or Shop (`ROOT_NOT_ALLOWED[pathPrefix]`; two at `/`
    overlap), one Shop mount a site (`MOUNT_TAKEN[app]`), the target refusal coded
    (`TARGET_INVALID[targetId]`, "Choose the store ..."), and the reserved paths gain `static`, `assets`, `sw.js`,
    `manifest.webmanifest` and `WebPush` (the framework's list). PASS `resolve#Route` routes `products/<id>/<slug>`,
    `categories/<id>/<slug>` and `pages/<path>` under the Shop mount to `/Shop/Products/ProductDetail`,
    `/Shop/Categories/CategoryDetail` and `/Shop/Page` (ids `[A-Za-z0-9_-]{1,40}`, anything else Not Found); the page
    reads the id from `publicPath` (F47). Account, Billing and Support under a root Shop keep their paths (longest
    mount wins).
  - The Shop root: `screen/Shop.xml` reads `getShopContext` first (Not Found for every failure of concealment) and
    `screen/Shop/Home.xml` shows the store's name and an empty state in the PASS shell until P2's theme. `getSiteInfo`
    (Forum.js) returns `brand` (from `PublicSite.theme`: six-digit hex `primaryColor`, `backgroundColor`, `textColor`,
    `surfaceColor` and a local or https `logoUrl`; anything else dropped) and `subscriptionUrl`; the Header adds the
    brand's colors and logo.
  - Headers (F3): `screen/Shared/Headers.js` (`ROUTES`, `policyOf`, `csp`, `apply`): `no-store`, `Referrer-Policy` and the
    shell's CSP by default, a route's `cacheControl` and `formAction` sources when it names them (none in P1); Pass.xml
    applies the default first and then the request's app and path within its mount.
  - Errors (F4, Purchasing F170 closed): `PassAuthority.envelope` answers `reason`, the camelCase form of the refusal's
    leading code (`CODE: text`, `CODE[field]: text`, after any `Error: ` prefixes) when `REASONS` lists it (design-shop
    §7.3's reasons and P1's three), `fieldErrors` `[{field, reason, message}]`, and for Unprocessable and Conflict the
    refusal's own text (other kinds keep the fixed message); Transport.js (`refused`, used by REST's error responses and
    gRPC's `answered`) puts them back as `reason[field]: text`; `Shared/Portal.js` `attempt` answers `{kind, reason,
    message, fieldErrors}`, a reason's page text from its `reasons` (the same keys as `REASONS`, checked by ShopAccess).
  - Context: Mantle `mantle.product.ShopCatalogServices.get#ShopContext` over `service/mantle/product/ShopContext.js`
    (`shopOf(siteId)`: the published site, its enabled Shop mount and the internal store, else `NOT_AVAILABLE`, NotFound;
    for every later Shop service): site, mount, store, locale, currency, `release` null (P2), capabilities (`canBrowse`,
    `canPurchase` false until P4/P5, `signedIn`).
  - Specs: mr-pass `test/Shop/ShopSpecLib.js` (records of its own: an internal and an outside organization with a store
    each, sites, `facade`, `mounts`, `remote` — PassAuthority.handle as a registered client, taken by Transport's
    `answered` —, `render`, `route`) and `ShopAccess` (4 features, 0.2 s: the target, one-mount, root and reserved-path
    refusals with their reasons, the readiness's `shop` checks, a non-operator refused; the root's routes; concealment of an
    unpublished site and a disabled mount, the context, the brand (unsafe values dropped), Home's one html render in the
    shell, the default headers; the remote context equal to the local one, a forged store field refused, a refused write
    with the same reason, field and text both ways, the two reasons lists equal). Mantle `PassAuthority` 6 features (+1:
    a listed reason with its field, an unlisted code, a NotFound's detail kept back), 0.1 s; its first feature now expects
    the request's own text. Also run, all pass: Forum, ForumAccess, Integrations, Portals, SupplierPages, SupportAccess,
    Transport (47 features with ShopAccess, mr-pass 3.6 s of 15 s); Mantle AccountingPortals, SupportPortal, StoreAdmin
    (32). Schema and Routes mirrors identical.
  - Acceptance: `acceptance/ShopMount.spec.js` (2 features: the operator mounts Shop at ZIZI_SHOP's root for POPC_DEFAULT,
    the reserved paths refused, `/account`, `/billing`, `/support` routed to their apps, readiness lists the store's
    findings; the anonymous root shows Ziziwork Retail Store, the remote context equals the local one, a second Shop mount's
    refusal reads `mountTaken` with the same text both ways). Without BOSS it makes ZIZI_SHOP as Commerce's demo does; it
    puts the site's state back. Run: 2 passed. No RemoteHttp feature: that walk needs the two-runtime setup; the transport
    is checked through the authority's answer.
  - Lint: `moqui lint --screens` flags none of the Shop screens, Pass.xml or the Shared files.
  - Demo (F33): ZIZI_SHOP's and ZIZI_DIGITAL's Shop mounts belong in mr-boss `service/ironstone/commerce/Demo.js` (it makes
    the sites); not made here (F48).
  - Decisions: concealment is strict (a published site and an enabled mount for everyone, operators too; preview is
    Commerce P5's); the context's service is Shop's catalog package (K) with the shared `shopOf` module; a reason is a
    Mantle code in the message (it survives service calls, which a property does not), allow-listed in one list per side;
    `onePerSite` is the registry's flag, set only on Shop.
  - Findings (provisional):
    - **F46** A refusal's message reaches a page as `Error: Error: CODE: text` after crossing service calls, so
      Portal.js's old code strip (`^[A-Z_]+: `) never matched and a local Unprocessable showed the prefixes. Both
      readers now drop them.
    - **F47** The framework's public-site routing passes only the Forum's ids from a resolver (`rootCommEventId`,
      `requestedTopicSlug`, `postId`; public_site.rs `parameters`), so Shop's product and category ids are read from
      `publicPath`. For the framework, optional: let a resolver return named route parameters.
    - **F48** For the lead (mr-boss, not edited here): Demo.js `ensureSite`'s mount list gains
      `["shop", <store>]` with the site's path, the store and path as fields of `sites`: ZIZI_SHOP `{productStoreId:
      "POPC_DEFAULT", shopPath: "/"}`, ZIZI_DIGITAL `{productStoreId: "BOSS_COM_DIGITAL", shopPath: "/shop"}`, written
      as `createOnce("mantle.public.PublicSiteApp", {siteId, appMountId: "shop"}, {app: "shop", pathPrefix: shopPath,
      enabled: "Y", targetId: productStoreId})`; the sites stay disabled until published.
    - **F49** The framework marks a request a public-site path when any `<public-site>`'s mount matches it, before
      the host check (public_site.rs `resolve_conf`), so a `/` mount on one host turns every non-framework path of every
      other host into "Public hostname not found". The test runtime therefore has no root mount; ShopAccess and ShopMount
      check the root through `resolve#Route`. For the framework: match mounts only on the route's own host.

- **Review Nov 5 (P1)** (mr-mantle, mr-pass; branch `shop/p1`): checked the diff in both repos against this section,
  design-shop §1, §4.1, §4.3 and §7.3, and §2: the `shop` registration (target `productStore` of an `OrgInternal`
  organization, `root`, `onePerSite`, readiness unchanged); `storeMounts`' one root and one Shop a site, the coded target
  refusal, the reserved paths; `shopOf` and `get#ShopContext` (Not Found unless a published site and an enabled mount,
  the site from the facade only); the brand values (hex colors only reach `<style>`, the logo cannot leave its quoted
  attribute or take a scheme other than https); Transport's and Portal.js' mapping; Headers.js (the default CSP equals the
  old one); Shop.xml's concealment; the Schema/Routes mirrors identical; the three `TOKEN_WRITES` lists; nothing in either
  diff references ironstone or mr-boss code (only docs and comments name them). The Built note is accurate.
  - **R1 (medium)** A refusal's own text went to a remote frontend for every Unprocessable and Conflict, and a service
    whose nested call fails without throwing ends as an Unprocessable whose text is the message facade's errors: a
    database error with entity and constraint names, a script's TypeError, a service name (`Transaction marked for
    rollback, not running service ...`). `PassAuthority.envelope` now keeps the fixed message when the text reads as a
    framework failure (`internal`: a database or script error word, a `://`, a `name#verb`, a package-qualified name);
    `Shared/Portal.js` does the same for a local page, which showed such text before P1. PassAuthority's P1 feature
    gains the two cases. Account's and the other operations' refusals (plain sentences) still pass.
  - **R2 (low)** The brand allows an https `logoUrl`, but the shell's CSP `img-src` is `'self' data:`, so such a logo never
    showed. `Headers.apply` takes the site's logo and adds its origin (a plain host and port only, so nothing else
    reaches the policy) to `img-src`; ShopAccess checks the origin and a forged one. Deployment.md says so.
  - Specs after the fixes: ShopAccess, Forum, ForumAccess, Integrations, Portals, SupplierPages, SupportAccess,
    Transport (47 passed); PassAuthority, AccountingPortals, SupportPortal, StoreAdmin (38 passed).
  - For the lead: F48 (the demo Shop mounts in mr-boss Demo.js) and F49 (the framework's host check) stay open as
    the Built note says. The `internal` guard is a deny-list; a stricter rule (pass only coded refusals' text) would need
    the uncoded Conflict/Unprocessable sentences in Mantle coded first.

### P2 — Theme engine and releases

Design-shop §12.1–§12.5 and §12.7's assets and remote delivery; SHOP-THEME, SHOP-RENDER's adapter.

- **The composition adapter** (mr-moqui, F10), on the locked renderer: a package's layout, JSON templates, sections,
  blocks and snippets resolved outside the template's expression namespace; the settings types of design-shop §12.3
  validated by their schemas; markup, URL, CSS and attribute contexts validated, rich text and SVG sanitized, `raw`
  only for adapter-made fragments; the budgets of design-shop §12.4 (100 sections a page, 100 blocks a section, depth 8,
  2 MiB of output, include depth) beside the renderer's deadline and memory, which operator configuration lowers; a
  renderer registry with `validate` and `render` (engine `js-fancy`); diagnostics with file and line; an optional
  section's failure omitted and logged, a required component's failure stopping purchase. Rust tests and goldens.
- **The release records** (Mantle `mantle.public`): `PublicTheme`, `PublicThemeRelease` (the immutable manifest: file
  versions and digests, schemas, settings, composition, renderer and view-API versions, the validation digest) and
  `PublicThemeBinding` (site and app mount to the active release, its revision and the site's generation). Theme files
  are `dbresource://` versions under one package root.
- **`mantle.public.ThemeServices`' core:** a draft from a starter package, `validate#Theme`, `publish#Theme` (the expected
  active revision, atomic switch, the generation), `restore#ThemeRelease` and the export manifest, which Commerce P5's
  editors call; the live render path: resolve the mount, authorize the site and page, select the active release,
  assemble the approved sources in batches, compose, render.
- **The view contract** v1 (design-shop §12.3) and the approved source descriptors; no `ec`, entity, session or secret
  in a view.
- **Assets and remote delivery:** release assets served by digest under the Shop mount; a remote frontend fetches a
  release's manifest and files over its authority connection, verifies every digest, and shows a safe unavailable page
  for a release it does not have.
- **The starter theme** in mr-pass, with every page kind and the required components, copied into editable resources
  when a draft starts from it.
- **Specs:** Rust tests of the adapter (each budget, each escaping context, script, event, scheme and recursion
  refusals); Mantle `test/public/ThemeReleases` (validation digest, publish and restore with the generation, a stale
  active revision refused); mr-pass `ShopThemes` (each page kind from the starter, an optional section's failure leaving
  the rest).
- **Usable when:** the starter theme publishes to ZIZI_SHOP and its home renders the store's name and an empty state; a
  section that loops forever stops at its budget and is left out; a template naming `ec` fails validation; a remote
  frontend renders the same release after checking its digests.

- **Built (framework), Nov 5, 2026** (mr-moqui, merged from com/fw, b502417e): the js-fancy composition adapter in
  `crates/moqui-core/src/script/theme/` (guide `docs/ui/Themes.md`), on the locked renderer (`render_locked_bounded`,
  token offsets for file and line). It resolves a package's layout (`${content}`, `${styles}`), JSON templates (an
  `order` when more than one section, `blockOrder` likewise), sections (`section`, `blocks`, `${block.html}`), blocks and
  static `<#include>` snippets; checks design-shop §12.3's settings by schema; checks markup, URL, CSS and attribute
  contexts in the source with file and line and again on each render's output; sanitizes rich text (`{"$richText"}`)
  and SVG; places unescaped only adapter-made fragments. Budgets 100 sections, 100 blocks, depth 8, include depth 8,
  2 MiB, 1 s a render, 5 s a page, 32 MiB, lowered (never raised) by conf `<resource-facade><theme-limits>` or a call.
  An optional section that fails is left out, logged and listed in `omitted`; a required section or component sets
  `ok` false with `failedRequired`. Services call `ec.resource.theme.validate(pkg, opts)` (`{ok, engine, diagnostics}`)
  and `ec.resource.theme.render(pkg, {pageKind or template, view, components, references, media, sources, assetBase,
  allowedOrigins, releaseId, limits})` (`{ok, html, diagnostics, omitted, failedRequired, dependencies}`), with
  `engines()`, `limits()`, `sanitizeSvg` and `sanitizeRichText`. Rust tests and goldens in `script/theme/tests.rs`.
  - **Review (framework):** R1 (high) the output check's tokenizer and the browser's tree builder disagreed inside
    foreign content (`<svg><desc><div></svg>…<style><img onerror>` validated); now `<` in `<style>`, tags in `<title>`
    and `<textarea>`, animation elements and foreignObject anywhere, fragments inside `<svg>` and output leaving an
    `<svg>` open are refused. R2 (medium) backslash URLs mapped to `/` before the origin check. R3 (medium) a memory
    limit of 0 meant none in QuickJS; clamped. R4 (medium) expressions built across an include: the assembled template
    is checked too. R5 (low) `form*` attributes refused, SVG presentation `url()` values checked as CSS, SVG assets keep
    only the SVG and XLink namespaces, template-literal property names caught. Left: names built at run time still reach
    `Function` inside the frozen sandbox (not an escape; removing `Function`, `eval` and the generator constructors from
    the locked sandbox is optional hardening).

- **Built (Mantle and mr-pass), Nov 6, 2026** (mr-mantle and mr-pass, branch `shop/p2`):
  - Records (`entity/PublicThemeEntities.xml`, `mantle.public`): `PublicTheme` (a store's theme: `productStoreId` for
    scope, `packageRoot` `dbresource://mantle/public/theme/{themeId}`, `draftRevision`, the last validation's digest,
    revision and outcome, `starterKey`, `sourceReleaseId`); `PublicThemeRelease` (immutable: `releaseSeq`, engine,
    `rendererVersion`, `viewApiVersion`, `validationDigest`, `manifestText` and its SHA-256 `manifestDigest`; the manifest
    holds the files with versions, digests and sizes, the schemas, `config/settings.json`, `defaultTemplates` and the
    composition: per template its layout, order and each section's type and named sources); `PublicThemeReleaseFile`
    (path, dbresource version, digest, size, type); `PublicThemeBinding` (site and app mount to the release, `revision`,
    `siteGeneration`, `activation`; `releaseId` and `activation` audit-logged, which is the activation history).
  - `mantle.public.ThemeServices` (`service/mantle/public/Themes.js`, core in its own sections; `ThemeView.js`, the
    page view): `create#ThemeDraft` (a starter `component/name`, read from the component's `theme/{name}`, or one of the
    store's releases; `COMMERCE_THEME_EDIT`), `get#ThemeDraft` (`COMMERCE_VIEW`), `validate#Theme` (the adapter's
    checks with every page kind required, the three required components declared, a bounded render of each of the 13
    page kinds with a synthetic view, which fails a page that does not place its component; the digest of the files'
    digests, engine, renderer and view API kept on the theme; `COMMERCE_THEME_EDIT` or `_PUBLISH`), `publish#Theme`
    (revalidates, `VALIDATION_STALE`, `THEME_INVALID`, the locked binding's `expectedActiveRevision` or
    `REVISION_STALE`, `THEME_STORE_MISMATCH`, then the release, its files, the binding and the site's generation in one
    transaction; `COMMERCE_THEME_PUBLISH`), `restore#ThemeRelease` (the pinned files rechecked by digest,
    `RELEASE_DAMAGED`, revalidated, `RELEASE_INVALID`, the same revision gate), `export#ThemeRelease` (the manifest, the
    files with `includeFiles`). Scope by StoreAdmin.js: the theme's store and the store the site's Shop mount targets.
    For P5 the module exports `pageKinds`, `requiredComponents`, `componentsOf`, `renderers`, `scopeWith`, `themeOf`,
    `draftFiles`, `putDraftFiles` (writes, bumps `draftRevision`; the caller checks it), `releaseFiles`,
    `validatePackage`, `packageDigest`, `activeRelease`.
  - The live path: PASS operations `getShopPage` (ThemeView.js: `shopOf`, the page kind's projection, the active release,
    the generation, the view contract v1 and the sources the release's composition names, each loaded once;
    `contract()` keeps only the contract's keys as plain JSON and drops `ec`, `sri`, `context`, `entity`, `session`,
    `user`, `password`, `secret`, `token`, `apiKey`, `credential` and names ending in secret, token, password, partyId or
    userId at any depth; P2's live kinds `home` and `not-found`, P3 on append to `pages` and `sources`),
    `getShopThemeRelease` and `getShopThemeFiles` (the active release only, `RELEASE_NOT_ACTIVE`; 50 files a call; a
    registered frontend only: PassAuthority's `CLIENT_READS`), `getSiteGeneration` (F43, in SiteServices: the
    generation and the active release, nothing personal), all in Schema/Routes and the mirrors and `Contracts.d.ts`.
    `getShopContext.release` is the binding's. Readiness gains a `theme` warning (an enabled Shop site with no
    published release on a supported engine and view API).
  - mr-pass: `screen/Shop/ShopTheme.js` (`packageOf`: the manifest's digest and each file's checked, engine and view API
    checked, kept in the `pass.shop.themeReleases` cache by release and digest; `renderPage` with PASS's trusted
    components of the page kind; `unavailablePage`, the built-in safe page, 503; `sendAsset`: an `assets/` file of the
    active release by its manifest digest, immutable, nosniff, an SVG cleaned again, `default-src 'none'`). `Shop.xml`
    sets `shopThemed` from the context's release, and `Pass.xml` leaves its header and footer out then; `Home` renders the
    release's home (the P1 shell page without a release); the `themeAsset` transition and `resolve#Route`'s
    `theme/{64 hex}/{path}` with `screenParameters` (F47's). The starter `theme/starter/` ("IronStone Starter"): a layout,
    13 page templates, 12 sections (hero, product grid, rich text, product, category, search results, page, cart,
    checkout, the account pages' component section, not found), a text block, two snippets, settings, CSS and a logo.
  - Specs: Mantle `test/public/ThemeReleases` (5 features, 2.2 s: the digest follows the draft, a template naming `ec`
    fails with its file and line 2, a missing required component; publish pins the files, revision 1 and the generation
    +1, publish again and restore with an audit row each and the generation +3, the export; a stale revision, a stale
    validation digest and a stale restore refused with nothing changed; a designer cannot publish, another
    organization's publisher sees nothing, another store's theme refused; the live reads only of the active release, the
    page view and the contract's drops). mr-pass `test/Shop/ShopThemes` (4 features, 1.2 s: the starter validates and
    renders each page kind with its components placed, PASS's components equal Mantle's; published, Home is the release's
    whole document with the store's name, `ShopEmpty` and its stylesheet under `/shop/theme/{digest}`, no PASS shell or
    session token, the CSS and SVG assets served and a wrong digest or path refused, the route; a failing optional section
    replaced by its placeholder and listed in `omitted`, the rest rendered; the remote render equal to the local one, a
    forged file the unavailable page, the manifest and files refused to an unregistered caller). Also run, all pass:
    ShopAccess, Transport, Portals, Forum, ForumAccess, Integrations, SupportAccess, SupplierPages; Mantle PassAuthority,
    StoreAdmin, StorePublication, AccountingPortals, SupportPortal; mr-boss CommerceStores, CommerceAccess (11). mr-pass
    2.5 s of 15 s. Schema and Routes mirrors identical.
  - Acceptance: `acceptance/ShopThemeRelease.spec.js` (4 features: the starter published to ZIZI_SHOP at its root for
    POPC_DEFAULT shows the store's name and the empty state in its own layout; a section that loops forever is left out
    at the time budget, the page in under 3 s, then the starter restored; a template naming `ec` fails at its file and
    line and publish is refused `THEME_INVALID`; the remote frontend's render equals the local one, a forged file shows
    the unavailable page). Run: 4 passed.
  - Lint: `moqui lint --screens` flags none of the Shop screens or Pass.xml.
  - Decisions: Mantle keeps the records and assembles the view; PASS verifies and renders, the same code locally and
    remotely; a theme belongs to a store (the publisher's scope is the store the site sells); the binding's audit log is
    the activation history (no event table); the release asset path is keyed by the manifest digest so a stylesheet's
    relative `url()` works; the theme source of the active release goes only to registered frontends.
  - Findings (provisional):
    - **F52** The adapter checks `locales/<name>.json` but no template function reads it (`localize` is the locked
      renderer's own), so the starter's texts are in its templates and settings. For the framework, optional: a package
      text lookup for the view's locale.
    - **F53** The framework reserves `/assets` at the root, so a root Shop cannot use design-shop's
      `/shop/assets/sha256-…`; release assets are `{mount}/theme/{manifestDigest}/{path}` (design §12.3 and §12.7 changed).
    - **F54** A screen's `actions` variables do not reach its parent's widgets (only `always-actions`' do), so Shop.xml
      decides `shopThemed` in always-actions and Home renders in its actions. P3's themed pages do the same.
    - **F55** The adapter's package is text only (`{files: {path: text}}`); images and fonts are named only. Binary
      theme assets (P5's upload) need bytes through the release reads, `getShopThemeFiles` and `sendAsset`; for P5 and
      the framework.
    - **F56** After a switch only the active release's assets are served, so a page rendered before it loses its
      stylesheet until reloaded; P3's caching by generation and release keeps that short.
    - **F57** `ec.resource.theme.engines()` gives no renderer version; Mantle's `renderers` table records version 1.
      For the framework, optional: the engine's version.
    - **F58** F43's Transport.js read-through cache by generation and release is not built here (`getSiteGeneration`
      is); P3 builds it with the catalog reads.
    - **F59** For the lead: the inventories' Implemented-in columns (mr-boss ss-inventory, usl-inventory) are mr-boss's
      and not edited here; the CLIENT_READS rule is checked in ShopThemes (it needs a published release), not ShopAccess.

- **Review Nov 5 (P2)** (Mantle and mr-pass; the framework adapter was reviewed with com/fw). Checked: the records
  (the release written once, its manifest digest, the binding's audit-logged releaseId and activation as the history);
  each core service's permission and store scope (the theme's store and the store the site's Shop mount targets, another
  organization's theme and another store's theme or release refused); publish's gates and the one transaction of
  release, binding and generation; restore's digest recheck; the live reads (only the active release, `CLIENT_READS` in
  PassAuthority's one `run`, which the REST, gRPC and edge paths all reach, so a browser or an unregistered client gets
  Not Found); `ShopTheme.js`'s manifest and per-file digest checks, engine and view API checks and the 503 page;
  `sendAsset`'s path (the route's and the asset pattern both refuse `..`, and only a file in the verified release's
  manifest is served); `shopThemed` leaving out the PASS header and footer only under Shop (Account, Billing and Support
  are other apps and keep the shell); the starter; Schema and Routes mirrors identical; the trusted-component tables
  equal (ShopThemes checks them); no `ironstone` or BOSS reference. Fixes:
  - R1 (medium) The view contract was a deny-list below its top-level keys: a projection handing `contract()` a whole
    record would have passed costs, internal names, draft text and any field not named in the list to theme source.
    ThemeView.js now projects through an allow-list, `shapes` (design-shop §12.3's v1 fields: site, shop, page,
    navigation, product and product cards with price, availability and image, category, cart, account), with the
    forbidden names still dropped; sources are projected through their descriptor's `shape` (product cards by default).
    Later phases append fields to `shapes` for their page kinds. ThemeReleases' contract case adds a record with
    `standardCost`, `internalName`, `ownerPartyId`, a price `cost` and a stock count, all left out.
  - R2 (medium) `publish#Theme` and `restore#ThemeRelease` had no operation identity (impl-commerce §2): a retry after a
    lost answer was `REVISION_STALE`. Both now take a required `operationKey` (PostingOperation `ThemePublish`,
    `ThemeRestore`), answered with the first result and `alreadyApplied` before any gate; ThemeReleases retries the
    first publish (same release, generation unchanged).
  - R3 (low) Two first publishes of a site (no binding row to lock) could both pass the revision gate and the second
    fail on the binding's key; the site's row is now locked before the binding, so the second is `REVISION_STALE`.
    Restore also refuses (`RELEASE_INVALID`) a release whose view API this authority no longer supports.
  - R4 (low) `pass.shop.themeReleases` had no bound (the framework's default cache has none), so every release a site
    ever activated stayed in a frontend's memory; it now keeps one verified release per site, replaced on a switch.
  - R5 (low) `sendAsset` served any file type under `assets/` by its extension's type; it now serves only `css`, `svg`
    and `json` and answers anything else Not Found.
  - Specs after the fixes: ThemeReleases 5, ShopThemes 4, ShopAccess, PassAuthority, StoreAdmin (26 passed; mr-mantle
    5.0 s, mr-pass 1.6 s of 15 s); mr-boss CommerceAccess and CommerceStores 11 passed; acceptance ShopThemeRelease 4
    passed. The Built note's "`contract()` keeps only the contract's keys ... drops" and "cached by release and digest"
    are superseded by R1 and R4.
  - For the lead: Commerce P5's editors must pass an `operationKey` to publish and restore; `COMMERCE_THEME_CODE`
    (template source edits) is not checked yet, since `putDraftFiles` has no caller until P5; P3's catalog projections
    must add their fields to `shapes` or they never reach a theme.

### P3 — Catalog pages

Design-shop §5, §11 and §12.7's caches; SHOP-CATALOG, SHOP-CONTENT, SHOP-RENDER. Ends stage C1/S1 with Commerce P5.

- **`mantle.product.ShopCatalogServices`** (K): `get#Home`, `get#Categories`, `get#Category`, `find#Products`,
  `search#Shop`, `get#Product`, `quote#Selection` and `get#Page`, over Commerce P3's publication resolver:
  - prices through `get#ProductPrice` as the authority for the routed store and the signed-in customer (F18): an
    unavailable price apart from a zero one, never the trace, cost or margin;
  - availability bands of crosscut §3.7 from `get#AvailableInventory` and its Multi form over the store's facilities,
    never quantities;
  - registered sort and facet keys; the `MantleProduct` index's hits filtered by the resolver (F32);
  - pages through Commerce P4's extended `get#SitePage`, the exact published version.
- **Operations:** `getShopHome`, `getStoreCategories`, `getStoreCategory`, `findProducts`, `searchShop`, `getProduct`,
  `quoteSelection` and `getShopPage`, with their mirrors.
- **Pages:** Home, Categories, CategoryDetail, Search, ProductDetail (purchase selection shows the price of a variant and
  quantity, with no add until P4) and Page; the not-available, empty and maintenance states; canonical URLs with stable
  IDs and slugs, old slugs redirected after the access check; sitemap, robots and hreflang of current public pages only;
  structured product data equal to the visible projection.
- **Caches** (F3): public caching of the anonymous catalog and content routes by the publication generation, release,
  locale and currency; a request with a cart or a signed-in user is `no-store`; an entry whose eligibility cannot be
  established is not served.
- **Links:** the Forum's product discussion checks the `shop` mount and the resolver (F28); ProductDetail's "Ask a
  question" opens a new Forum topic in the site's product category linked by `CommunicationEventProduct` when the site
  has a Forum mount (design-shop §5); ZZW_RETAIL's pages are
  served by the demo site's Page route, and the space's `publicPageUrl` moves there (impl-commerce F17).
- **Specs:** Mantle `test/product/ShopCatalog` (an unpublished product, an excluded variant, a wiki draft and another
  store's product absent from every read, the sitemap and search included; unavailable against zero price; no trace);
  mr-pass `ShopCatalog` (one render per page kind, the cache headers by route).
- **Usable when** (design-shop §18.1 "Two sites", "Anonymous browse"): an anonymous visitor browses POPC_DEFAULT's
  published categories and products, searches, and reads its returns policy page, with and without JavaScript, at 390 px
  and on the desktop (`acceptance/client/ShopHttp`); ZIZI_DIGITAL shows only BOSS_COM_DIGITAL's products, and neither
  site another's; nothing unpublished shows anywhere; the same through a remote
  frontend (`acceptance/client/ShopRemoteHttp` with its fixture).

- **Built (framework), Nov 5, 2026** (b502417e; F42): a response whose `Cache-Control` has `public`, to a request with
  no verified session cookie and no signed-in user, sends no `Set-Cookie`, `moquiSessionToken` or `X-CSRF-Token`, and
  its session is discarded unwritten (`user::session::discard_bound_session`); an `ETag` with a matching
  `If-None-Match` on a GET or HEAD answers 304. The conf's public server-static templates and long-cached files no
  longer give a cookieless request a session. Left for the framework: a visitor with a session who gets a `public`
  response can still get a rotated cookie or token, which Shop avoids by sending `public` only with no session.

- **Built (Mantle, mr-pass, mr-boss), Nov 6, 2026** (branch `shop/p3`):
  - Mantle `service/mantle/product/ShopCatalog.js` (new) and `ShopCatalogServices.xml`'s `get#Home`, `get#Categories`,
    `get#Category`, `find#Products`, `search#Shop`, `get#Product`, `quote#Selection`, `get#Page`, `get#Sitemap`
    (anonymous, input map, the site from the facade through `shopOf`). Candidates are cheap (the store's current
    published rows, a category's members, the `MantleProduct` index hits, F32, and a name match over the published rows),
    sorted by a registered key (`featured`, `name`, `newest`), paged by an opaque cursor, and only a page's candidates are
    resolved by StoreMerchandising.js `resolve`, in chunks until the page is full (F51). Cards: name (the store's
    `PcntProductName` content first), canonical URL with SitePages' slug, SKU, price (`available` false told apart from a
    zero price; a virtual's lowest public variant price "From"), list price as compare-at, an availability band (in stock,
    low stock at 5 or less, backorder when the store does not require inventory, out of stock, available for unstocked
    types) from one `get#AvailableInventoryMulti`, badge text. The category tree: the browse roots' children (four levels,
    300 nodes), a category kept when it or one below has a current published member. A product: its store description
    (`PcntDescriptionLong`, `PcntDescription`, sanitized rich text), its public variants with their distinguishing
    features, the quote of a variant and quantity (1 to 999; an option not listed is `VALUE_INVALID`). A page: Commerce
    P4's `get#SitePage` by mount, route and locale (the exact published version) with its policy role and version. Every
    answer carries `generation` and `releaseId` (F43). Search answers `results`, `noMatch` or `unavailable` (neither the
    index nor the database could be searched) and the site's live Shop pages by title.
  - Prices (F18): `mantle.product.PriceServices.get#StoreProductPrice` (new, in process only): `get#ProductPrice`'s
    resolver and modifiers with `storeAuthority`, set only in that service's script, under which PriceResolver.js
    `readable` admits the public rows, the store organization's and the signed-in customer's own, never an agreement's,
    an average cost or another party's, and no trace. `get#ProductPrice` is unchanged (ShopCatalog checks it still gives
    the public no store-organization row).
  - ThemeView.js: the page kinds `home` (featured products), `category` (with no category the Categories page: a
    category "Categories" whose children are the tree), `product`, `search` and `page` from ShopCatalog.js `views`; the
    sources `featuredProducts`, `newProducts`; `shapes` gain `price.available`, the card's `availability.code` and
    `badge`, `shop.searchUrl` and `categoriesUrl`, `page.nextUrl`, `sort`, `resultState`, `contentResults`, `locale`, the
    product's `slug`, `variants`, `selectedVariantId`, `quantity` and `quote`, the category's `children` (two levels).
    Themes.js requiredComponents gain `shop.search` on `search` (a theme has no `<form>`); ThemeReleases' package places it.
  - F50: `get#StorePublication` refuses a caller without `COMMERCE_VIEW` in the store's scope and no `siteId`
    (`SITE_REQUIRED`) and answers nothing public on a site that is not published; `resolve` is unchanged (Commerce P4's
    navigation checks an unpublished site's menu with it). StorePublication's anonymous calls pass the site.
  - F28: ForumIntegration.js `productPublic` reads the site's enabled `shop` mount's store and the resolver (was a `store`
    app and the publication row); PASS Integrations mounts `shop`.
  - F56, F17: Knowledge.js `get#ArticlePublicLink` links the source organization's Support mount on its first published
    site (`PublicApps.sitesFor`, `pageUrl`: `/support/CustomerArticle?wikiPageId=`), else the space's `publicPageUrl`;
    ZZW_RETAIL's `publicPageUrl` is the demo Shop site's article page (absolute), its `publicAttachmentUrl` empty (PASS
    serves no wiki file), and `/pcontact` is dropped (ZcaProductDemoData.xml). ZZW_RETAIL's pages stay knowledge articles
    (F76's second choice). mr-boss CustomerServiceKnowledge expects the article page.
  - F75: PASS operations `getSiteNavigation`, `resolveSiteRedirect` and the catalog's `getShopHome`, `getStoreCategories`,
    `getStoreCategory`, `findProducts`, `searchShop`, `getProduct`, `quoteSelection`, `getStorePage`, `getShopSitemap`
    (routes under `shop/` and `site/`); `getShopPage` gains the catalog kinds' inputs; Schema/Routes mirrors identical;
    `Contracts.d.ts`; design-shop's §14.1 PublicSitePage row and §13.1, §5.1, §12.7 as built.
  - mr-pass pages: `Shop/Catalog.js` (one `getShopPage` call a page, rendered by ShopTheme.js `renderView`, or with no
    release the view in the PASS shell, `Shop/Catalog.html.fancy`; an old slug 301 to the canonical URL after the access
    check; a product, category or page that is not public the theme's not-found page (404) unless `resolveSiteRedirect`
    moves it; the head gains the canonical page's hreflang, a product's schema.org data from the view the page shows, and
    noindex on a search; `robots.txt` and `sitemap.xml` of current public pages with absolute URLs), `Shop/Home.xml`,
    `Shop/Categories.xml` with `List` and `CategoryDetail`, `Shop/Products.xml` with `ProductDetail`, `Shop/Search.xml`,
    `Shop/Page.xml` (in always-actions, F60); `Home.html.fancy` removed. `resolve#Route` passes the product, category
    and page ids as `screenParameters` (F47) and routes `robots.txt`, `sitemap.xml`. ShopTheme.js: `shop.productPurchase`
    is a GET form of the variant and quantity showing the quote (no add until P4), `shop.search` a GET search form; a
    release gets only the components its `theme.json` declares, so one published before `shop.search` still renders. The
    starter: the category tree and subcategories, the search states and form, compare-at price, badge, availability on
    cards, Categories and Search links, an icon link, 44 px form controls.
  - Caching (F42 mr-pass part, F3): Headers.js `ROUTES` gives Shop's catalog routes `public, max-age=60` with
    `anonymousOnly` (no signed-in user and no session cookie), else `no-store`; Catalog.js keeps it only for a 200 and adds
    an ETag of the content; the shell's header on a public page has no session token and a neutral Account link (a themed
    page has neither). F43/F58: Transport.js `readThrough`, a bounded (512 slots by key digest) read-through cache of
    anonymous catalog GETs (no user, delegation or token) keyed by site, operation, input, locale, currency, generation
    and release; the generation (`getSiteGeneration`) read at most every 2 s, entries kept at most 60 s, an answer naming
    another generation and every refusal not kept, nothing served when the generation cannot be read.
  - Test conf: `test/MoquiConf.xml` names `shop.zizi.localhost` (ZIZI_SHOP, Shop at `/`) and `digital.zizi.localhost`
    (ZIZI_DIGITAL, `/shop`) public sites, and `pass_client_test_sites` adds both, for the walks.
  - Specs: Mantle `test/product/ShopCatalog` (2 features, 0.41 s: an unpublished product, a draft, an excluded variant and
    another store's product absent from the list, a category, search and the sitemap, and Not Found as a product; another
    store's category refused; a page's published version shown and its later draft not, a page with no published version
    absent; an unlisted sort refused; zero against unavailable prices, a store organization's row priced for Shop and not
    by `get#ProductPrice` for the public, a quote of 3, an option not listed refused, no trace, price id or cost). mr-pass
    `test/Shop/ShopCatalog` (2 features, 0.25 s: one render through the published starter of Home, Categories, a category,
    Search, a product with its quote and structured data, a draft's not-found page and a page, none with a session token;
    each catalog route public for an anonymous request only, cart, theme asset and Account no-store; Transport's cache
    kept by generation and input, never for a write or a signed-in user; the remote product view equal to the local one,
    a draft Not Found remotely). Also run, all pass: mr-pass ShopAccess (its Home now expects the public page's neutral
    Account link and no token), ShopThemes, Forum, ForumAccess, Integrations, Portals, Transport, SupportAccess,
    SupplierPages, Operations (62, 6.5 s); Mantle StorePublication (+1 assertion, `SITE_REQUIRED`), ThemeReleases,
    SitePages, PassAuthority, StoreAdmin, ProductEffectivePrices, ProductPricePolicy, ProductPriceLists, Promotions,
    SupportPortal (60 with ShopCatalog); mr-boss CustomerServiceKnowledge, CommerceSitePages, CommerceAccess,
    CommerceAssortment, CommerceStores, Knowledge (44). Not run: `./moq test-apps` and the budget measure.
  - Acceptance: `acceptance/ShopFixtures` (the demo Shop sites as Commerce's demo makes them, published; POPC_DEFAULT's
    demo publication, BOSS_COM_DIGITAL's digital guide, ZIZI_SHOP's starter release and returns page; ZIZI_DIGITAL
    unthemed), `acceptance/client/ShopHttp` (4 features: at 390 px Home, Categories, Demo Category One, Demo Product
    One-One at $16.99, a quantity of 3 ($50.97), a search and the returns page, no horizontal overflow; on the desktop
    ZIZI_DIGITAL shows only its guide in the PASS shell and Not Found for POPC_DEFAULT's product, ZIZI_SHOP Not Found for
    the guide; without JavaScript (plain requests) the links, the old slug's 301, the quote and structured data, DEMO_VAR
    Not Found and absent from search and the sitemap, robots naming the sitemap; a cookieless request public with no
    cookie or token and an ETag, a 304 to revalidate, no-store with a session and for a 404),
    `acceptance/client/ShopRemoteHttp` (2 features: the same sites and pages, the public headers and 304) with `acceptance/ShopRemoteFixtures`
    (the frontend: no Mantle catalog, both contexts from the authority). Run: ShopHttp 4 passed and ShopRemoteHttp 2
    passed under `./moq accept mr-pass --spec` (local authority); then Deployment.md's two-runtime check over REST (the
    authority serving ClientFixtures, PortalFixtures and ShopFixtures on 127.0.0.1:18091, a frontend runtime of framework,
    webroot, tools and PASS only on 18092): ShopRemoteFixtures 1, ShopRemoteHttp 2 and ShopHttp 4 passed. gRPC not run.
  - Lint: `moqui lint --screens` 132 sites as before, none in the Shop screens, Pass.xml or the Shared files.
  - Inventories (mr-boss usl-inventory): Implemented in of `get#SitePage`, `get#ProductPrice`,
    `get#AvailableInventoryMulti` and `get#AvailableInventory` for the Shop pages.
  - Decisions: `getShopPage` stays the themed view (P2's name), so the Page's JSON read is `getStorePage`; the Categories
    page is the `category` kind with no category (no new page kind, so P2's releases stay valid); `shop.search` is a
    required component of `search`, and PASS gives a release only the components it declares; with no release the
    catalog pages show the same view in the PASS shell; a public page's header shows a neutral Account link instead of a
    fetched signed-in fragment (no script under the shell's CSP); a category is listed by its current publication rows,
    not by resolved products (bounded); F50's checks are in the service, not in `resolve`.
  - Findings (provisional):
    - **F60** The framework opens a screen's output with status 200 (`start_output` in screen render.rs and sri), so a
      status a screen's actions set never reaches the browser (P2's Home 503 did not either). Catalog.js writes a themed
      404, 503 or redirect before the render (a body written first keeps its status); a PASS-shell 404 is the framework's
      Not Found page. For the framework: keep a status set before the output opens.
    - **F61** Product images are ProductContent `component://` or `dbresource://` locations, not public URLs, so P3
      shows none; a public image route by content id behind the resolver (or theme media) is needed.
    - **F62** `get#StorePublication`'s public list mode still resolves every published row before paging (F51); Shop
      no longer calls it, so Commerce may drop the public list mode.
    - **F63** Pass.xml still calls `getSiteInfo` (per user, uncached) on every page, so a remote themed page costs it
      and the generation read; caching an anonymous `getSiteInfo` needs its mounts and brand under the generation.
    - **F64** The authority price does not apply PriceResolver.js `extras` (feature extras of a virtual fallback),
      which only a price reader gets; the stock bands' threshold (5) is fixed, with no store setting.
    - **F65** hreflang names only the page's own locale: Shop URLs carry no locale.
    - **F66** Existing databases keep ZZW_RETAIL's old `publicPageUrl` and `/pcontact` (data loads only on a new
      database); Knowledge.js prefers the Support mount's article page either way.

- **Review Nov 5 (P3)** (Mantle, mr-pass, mr-boss; branch `shop/p3`). Checked: `get#StoreProductPrice` (allow-remote
  false; `storeAuthority` is set only in its script, and `get#ProductPrice` declares no such parameter, so the
  framework's validation drops one a caller passes; `traceAllowed` false under it; `readable` admits only public rows,
  the store organization's and the signed-in account's party's own, and `typed` already requires an exact vendor,
  customer and agreement match; the customer comes from `ec.user.userAccount`, never the input; `get#ProductPrice`'s
  path unchanged with the flag false); ShopCatalog.js (every read through `shopOf` of the facade's site, published,
  enabled Shop mount, internal store; the resolver with the site on every candidate list, index hits filtered by the
  published rows and then resolved; candidates bounded at 2000, page size 1 to 48, the cursor an offset into the
  site's own candidate list, so it reaches neither another store nor an unbounded read; bands never quantities; no
  price id, trace or cost in an answer); F50 in `get#StorePublication`; F28's `productPublic`; ThemeView's new shapes
  (allow-listed) and the schema.org data built from the same view; Headers.js's anonymous-only public routes (the
  framework's session cookie name), the shell header with no token on a public page, Catalog.js's no-store on every
  answer but 200 and an ETag of the content (the framework answers 304 only for a matching tag on GET/HEAD); the old
  slug's 301 only after the view was read, redirects only through `resolveSiteRedirect` (staff-configured
  destinations checked by `checkDestination`); Transport.js `readThrough` (bounded, keyed as the note says, never for a
  user, delegation or token, nothing kept on a refusal, a fetch when the generation cannot be read); Schema/Routes
  mirrors identical; no `ironstone` or BOSS reference. Fixes:
  - R1 (low) A PASS-shell page's ETag was the digest of the view only, so a change to the shell's own header (the site's
    name, brand or mounts, which do not advance the generation) still answered a revalidation 304 with the old page;
    the shell's tag now covers `siteInfo` as well.
  - R2 (low, spec) The authority price's customer rule had no spec: ShopCatalog (Mantle) gains a feature (0.08 s) where
    the signed-in customer gets its own row (6.00) over the store's (7.00) and never another party's (2.00), and
    `get#ProductPrice` called with `storeAuthority: true` still gives the public no store row. ShopHttp's caching
    feature also checks the PASS shell's Not Found (ZIZI_DIGITAL) is not public (the framework's page is no-store).
  - Specs after the fixes: Mantle ShopCatalog 3, with StorePublication, ProductEffectivePrices, ProductPricePolicy 18
    passed; mr-pass ShopCatalog, ShopAccess, ShopThemes, Transport 12 passed; acceptance ShopHttp 4 passed. The worker's
    lists before the fixes: mr-pass 62, Mantle 65 (the Built note says 60), mr-boss 44, all passed.
  - For the lead: (1) ProductDetail's "Ask a question" Forum link (this section's Links) is not built and the Built
    note does not say so. (2) Knowledge.js still refuses `NO_PUBLIC_URL` before trying the Support site's article page,
    so an organization with a Support site but a space with no `publicPageUrl` cannot send a link; decide the order.
    (3) A category is listed by current publication rows, so one whose only members are published but not public (a
    draft, an unsellable product) shows with "No products here yet"; it shows only the category's own name. (4) Search
    hands the visitor's text (100 characters) to the index as a query string, so its syntax (fields, wildcards) is the
    visitor's; hits are filtered, but an escaped or simple query would bound the cost. (5) Prices and stock do not
    advance the generation, so a public page and the remote cache may be up to 60 s behind (by design). (6) F64
    stands: anonymous visitors get no feature extras on a virtual fallback, which a price reader gets.

### P4 — Cart and shopper identity

Design-shop §4.2, §6 Cart and §7.1; SHOP-CART, SHOP-ACCOUNT's identity part.

- **`StoreCartAccess`** (`mantle.order`): the order, site, mount, store and currency, an optional verified customer, the
  capability digest, a one-time recovery token digest (Commerce P10), last shopper activity, expiry and revocation.
  ExternalAccess.js exports its digest and throttle helpers for it (F16).
- **`mantle.order.ShopCartServices`** (design-shop's C): `get#Cart`, `add#CartItem`, `update#CartItem`,
  `remove#CartItem`, `apply#PromoCode` and `remove#PromoCode` over the Mantle order and promotion services, checking the
  cart's `orderRevision` (F17), the cart's part always carrying a customer party (an anonymous one for a guest) so the
  sales commercial revision applies (impl-commerce F40); activity on shopper actions only; login attaches the shopper's
  cart or merges two proven carts of one scope with no pending checkout, repricing and naming unavailable lines; logout
  rotates the capability.
- **Merges** (F23): StoreCartAccess follows `merge#Parties` by rule, a merge never moving a cart on email alone.
- **Operations:** `getCart`, `addCartItem`, `updateCartItem`, `removeCartItem`, `applyPromoCode` and `removePromoCode`,
  the cart writes in `TOKEN_WRITES` with the session-bound capability, local and remote (F29); rate limits on cart
  creation and code tries.
- **Pages:** Cart (CartItems, PromoCode, CartTotals, BeginCheckout from P5); ProductDetail's PurchaseSelection, a trusted
  Vue component over the plain form; the mini-cart projection.
- **Specs:** Mantle `test/order/ShopCart` (no price, customer, store or status from input; a stale revision refused; one
  merge of proven same-scope carts; another store's or currency's cart kept apart; an order ID alone grants nothing;
  logout rotation); mr-pass `ShopCart`.
- **Usable when** (design-shop §18.1 "Guest checkout and later account login", its cart half): a guest adds two items,
  applies TEST1 and sees the discount; signing in merges a proven cart once; another tab's stale change is refused with
  its reason; the same through a remote frontend.

- **Built (framework), Nov 5, 2026** (b502417e; F45): `WebrootPublic.qvt.js` island mode: each
  `<script type="application/json" data-moqui-island="mountId">` mounts its screen's qvue at that element without the
  `q-layout`, several per page, each with its own route; one failing island leaves the others; page mode unchanged;
  `moqui.publicIslandConfigs`, `startPublicIslands`, `publicIslandTemplate`. The config is read only from a JSON script.

- **Built (Mantle and mr-pass), Nov 6, 2026** (branch `shop/p4`):
  - Records (`entity/ShopCartEntities.xml`): `mantle.order.StoreCartAccess` (order, site, mount, store, currency, the
    verified customer, the guest's anonymous party `guestPartyId`, the capability's digest (unique), the recovery token's
    digest and use for Commerce P10, last activity, expiry, rotation, revocation with `StoreCartRevokeReason` (ScrMerged,
    ScrPlaced, ScrExpired, ScrCancelled) and `mergedToCartAccessId`). ExternalAccess.js exports `tokenDigest` and
    `throttle(scope, limit)` (F16), `tokenCapability` now uses both (its refusal reads `RATE_LIMITED: ...`).
  - `mantle.order.ShopCartServices` (`ShopCartServices.xml` over `service/mantle/order/ShopCart.js`, anonymous, input map,
    the site from the facade through ShopCatalog.js `shopOf`): `get#Cart`, `add#CartItem`, `update#CartItem`,
    `remove#CartItem`, `apply#PromoCode`, `remove#PromoCode`, `attach#Cart` (sign-in), `release#Cart` (sign-out). A cart is
    reached by the session's capability (only its digest kept; lookups throttled, 600 per 10 minutes a requester) or the
    signed-in account's own cart in the site, store and currency; a token of another scope, expired, retired or of another
    account's cart reaches nothing, and no operation takes an order id. The first add makes the cart: `create#Order` (open,
    `ScWeb`, the store's organization the vendor) with the account's party, else an anonymous guest Party (Person "Guest",
    Customer role) as the part's customer (F36/impl-commerce F40), and a new 48-character capability in `result.token`;
    creation throttled (30 per 10 minutes). Lines: the selection through ShopCatalog.js `selectionOf` (the product or a
    listed option), `add#OrderProductQuantity` / `update#OrderItem` / `delete#OrderItem` with the line's `unitAmount` the
    store authority's price at the line's quantity (`offersOf`: `get#StoreProductPrice`; F18, so a visitor's line has the
    catalog's price), quantities 1 to 999, 50 lines; an item that cannot be bought now `ITEM_UNAVAILABLE`. Codes:
    the store's code (ignoring case) through `add#OrderPromoCode` / `remove#OrderPromoCode`; every refusal
    `PROMO_CODE_INVALID[promoCode]` with one text; code tries throttled (20 per 10 minutes). Each change of a cart's
    contents requires `expectedRevision` (an add checks it when given), the order's `orderRevision`
    (`STALE_REVISION`, Conflict); `operationId` answers the first result again (PostingOperation `ShopCart`, keyed by the
    cart and the id, `OPERATION_CONFLICT` for another request); a cart with a payment in progress is `CHECKOUT_PENDING`.
    Activity and expiry (30 days a guest's, 90 an account's) move on shopper actions only. The CartView (`Contracts.d.ts`):
    lines (name, options, link to the product, quantity, unit price, adjustments, total, availability band, a changed
    price named), codes, totals (items, discounts, shipping and tax when the order has them, estimated total), item count,
    notices (an unavailable line, a changed price, a promotion past its limit by `check#OrderPromotionLimits` with
    `lock:false`, impl-commerce P7), revision, and the mini-cart `summary`. Sign-in: the session's guest cart is attached
    (the part's customer becomes the account's party) or merged once into the account's cart of the same scope when
    neither has a payment in progress (lines re-added at the account's prices, codes tried again, unavailable lines
    named, the guest access retired `ScrMerged` and its order cancelled), repriced, and its capability rotated. Sign-out
    rotates every open cart's capability of the account in the site.
  - merge#Parties (F23): StoreCartAccess's `customerPartyId` and `guestPartyId` move with the party; nothing matches on an
    email address.
  - Catalog (ShopCatalog.js): F64, PriceResolver.js `extras` apply for the store's authority (features with no owner or the
    store organization's), so a variant priced by its virtual gets its feature extras; `get#ProductPrice` unchanged.
    F67, search text reaches the index as words (`simpleQuery`: the query syntax escaped, `AND`/`OR`/`NOT` lower-cased).
    F61, `get#ProductImage` (`getShopProductImage`): a `PcntImage*` content of a png, jpeg, gif or webp file in effect for
    the store, of a product public now; cards and the product view gain `image` and `images` (`{mount}/media?productContentId=`).
    Exports for the cart: `shopOf`, `selectionOf`, `offersOf`, `quantityOf`, `money`, `unavailablePrice`, `simpleQuery`.
  - ShopContext gains `capabilities.canUseCart`; ThemeView gains the `cart` page kind (the store's view only, so it stays
    cacheable; PASS sets `view.cart` from the shopper's `summary`) and `shop.cartUrl`.
  - PASS operations `getCart`, `addCartItem`, `updateCartItem`, `removeCartItem`, `applyPromoCode`, `removePromoCode`,
    `attachCart`, `releaseCart` (`shop/cart...`) and `getShopProductImage` (`GET shop/media`, a download in PassAuthority's
    `DOWNLOADS`), in Schema/Routes and the mirrors (identical) and `Contracts.d.ts` (`CartView`, `CartLine`). The five cart
    writes are in the three `TOKEN_WRITES` lists (F29: the capability in `input.token`, local and remote), and Transport's
    `routeOf` lets `addCartItem` go with no capability (F44, as `applyOptOut`); Transport, PassApi and PassAuthority export
    their lists. REASONS and Portal.js `reasons` gain `itemUnavailable`, `promoCodeInvalid`, `checkoutPending`,
    `valueInvalid`.
  - mr-pass pages: `screen/Shop/ShopCart.js` (the session's capability under `passShopCart:{siteId}`, never in a page, a
    cookie or a URL; `call`, the purchase selection's and the cart's plain forms, the islands' configs, the transitions'
    answers and the sign-in hooks), `Shop/Cart.xml` (transitions `add`, `quote`, `update`, `remove`, `applyCode`,
    `removeCode`, `state`; the page through the release's cart page with the `shop.cart` component, or in the PASS shell,
    `Cart.html.fancy`), `Shop/Cart.qvue` and `Shop/Purchase.xml` with `Purchase.qvue` (F45: islands over the plain forms
    through `WebrootPublic.qvt.js` island mode; a price updates in place and an add announces the cart's count without
    leaving the page; their posts carry the session's form token, which `Cart/state` answers). The purchase selection
    (ShopTheme.js `shop.productPurchase`) posts to `Cart/add`, its Show price to `Cart/quote` (a redirect to the product's
    page with the selection); a form carries the session's form token only for a visitor with a session (a cookieless post
    starts one), so a public product page has none. Every write answers with a redirect and a one-time notice, or JSON
    with its status for an island. Shop.xml's `media` transition streams a product image (`Facade.downloadFile`). The shell
    header and the starter layout gain a Cart link. Account.js calls ShopCart.js `signedIn` after a sign-in (local, remote
    and SSO) and `signingOut` before a sign-out; neither can fail them. Portal.js `attempt` takes `{newTransaction: true}`
    (F69), which the cart's writes use. Headers: the Cart routes keep the default no-store. Deployment.md "Cart".
  - Specs: Mantle `test/order/ShopCart` (5 features, 0.9 s: a guest's first add with a capability, the input's price,
    customer, store and status ignored (the authority's 12.00, the guest party, the store, open), an order id alone
    reaching nothing; a stale revision refused, an operation id answered once, another store's and an unknown code refused
    with one text, a code applied (2.00 off) and removed; another store's and currency's cart apart both ways; sign-in
    merging the guest cart into the account's once (cancelled, `ScrMerged`, the second attach merging nothing, the old
    capabilities reaching nothing, a visitor with the account's capability reaching nothing) and sign-out rotating;
    merge#Parties moving the access). Mantle `test/product/ShopCatalog` (+2 features, 0.13 s: F64's extra (23.00 for the
    store, 20 for `get#ProductPrice`'s public); F61's image (a png of a public product served, an svg and a draft's not)
    and F67's escape). mr-pass `test/Shop/ShopCart` (3 features, 0.4 s: the Cart page's one render through the starter
    with lines, forms, revision, operation id, the island and the Cart link, never the capability; the five writes in all
    three lists, the first add's route with no capability and a change's refused, the remote cart equal to the local one,
    a stale revision `staleRevision` and a refused code `promoCodeInvalid[promoCode]` with the same text both ways, no
    capability no cart; sign-in attaching and rotating, sign-out dropping the session's capability). mr-pass
    `ShopCatalog`'s product render gains the purchase form's checks. Also run, all pass: Mantle ShopCatalog,
    PassAuthority, StorePromotions, ProductEffectivePrices, ProductPricePolicy, PartyServices, ThemeReleases,
    SupportPortal, AccountingPortals, StoreCheckout, Promotions, ProductPriceLists, ProductVariants, ContactBooks,
    StorePublication, SitePages, StoreAdmin (137 with ShopCart, 25.2 s of 370); mr-pass ShopAccess, ShopCatalog,
    ShopThemes, Forum, ForumAccess, Portals, Transport, Integrations, SupportAccess, SupplierPages, Operations,
    SsoHandoff, PublicIdentity (73 with ShopCart, 6.3 s of 17); mr-boss CommerceAccess, CommerceStores,
    CommercePromotions, CustomerServiceKnowledge (19). Not run: `./moq test-apps`. Schema and Routes mirrors identical.
  - Acceptance: `acceptance/client/ShopCartHttp` (1 feature: at 390 px on ZIZI_SHOP a guest's quantity priced in place, two
    adds announced without leaving the page, the product image through the media route, the cart island, TEST2 applied
    with its discount, then sign-in merging into the shopper's own cart with the notice, no horizontal overflow) and
    `acceptance/client/ShopCartRemoteHttp` (2 features, plain requests: two adds from the product's form (a public page
    with no form token), TEST2's discount, another tab's older removal refused with its reason (the notice, and 409
    `staleRevision` as JSON) and nothing removed; sign-in merging once, sign-out leaving no cart, a second sign-in adding
    nothing); ShopFixtures gains the two shopper accounts with their carts; ShopHttp's quantity step now uses the island.
    Run: `./moq accept mr-pass` once: the client suite 40 passed (with ShopCartHttp 1, ShopCartRemoteHttp 2, ShopHttp 4,
    ShopRemoteHttp 2); the server suite 10 passed, 4 failed, 3 ignored: ShopThemeRelease's two empty-state features
    (Home shows the demo's featured products since P3) and ShopMount's two when run with ShopFixtures in one server, all
    four failing the same on master (for the lead). Then Deployment.md's two-runtime check over REST (the authority
    serving ClientFixtures, PortalFixtures, SupplierPortalFixtures, SupportFixtures and ShopFixtures on 127.0.0.1:18091, a
    frontend of framework, webroot, tools and PASS only on 18092): ShopRemoteFixtures 1, ShopCartRemoteHttp 2,
    ShopCartHttp 1 and ShopRemoteHttp 2 passed. gRPC not run.
  - Lint: `moqui lint --screens` 132 sites as before, none in the Shop screens, Pass.xml or the Shared files.
  - Inventories: mr-boss's usl-inventory and ss-inventory are not edited here (mr-boss is read only for this phase; F59).
  - Decisions: the CartView is the cart's own projection, not `get#OrderDisplayInfo` (design-shop §6 and §13.2 changed);
    each line holds the authority's price as its `unitAmount` (Mantle's add path prices by the public reader for a
    visitor); a cart's first add is not replayable by operation id (its capability is never stored, so a replay could not
    return it; a lost first answer leaves a cart to expire); "a pending checkout" is a payment of the order in progress
    until P5's checkout records join it; the cart page's theme view stays the store's (cacheable) and PASS adds the
    shopper's summary; the form token goes only to a visitor with a session; `valueInvalid` is a listed reason, so a
    field's refusal reaches a remote page with its field.
  - Findings (provisional):
    - **F68** TEST1 (design-shop §18.1's code) is limited to CustJqp (`requireParty`), so a guest cannot use it; the
      walks use TEST2, whose Buy 1 Get 1 Half Off needs two of one item. PopcNewCustomer's 20% needs a user account for a
      web order, so a guest gets none.
    - **F69** A refused nested service call marks the calling transition's transaction rollback-only, so a refused
      cart write answered as a redirect or JSON became a 500 ("transaction marked rollback-only"). The cart's writes run
      through `Portal.attempt(..., {newTransaction: true})`; Billing's and Support's page writes call without it, and may
      meet the same on a refusal (for the lead).
    - **F70** `ec.web.sendJsonResponse` answers only 200 or 500 and adds the request's messages (Mantle's promotion
      notes), so the cart writes its JSON with its own status.
    - **F71** Sign-in's default landing is `passBases.forum` (`/forum`) on any site, a 404 on a Shop site with no Forum
      mount (the walk passes `returnTo`). For the PASS Account pages: land on the site's root app.
    - **F72** An island's first request (its `.qvue`, or `Cart/state`) starts a session, so after a visitor's first
      enhanced product page later catalog pages are no-store for them (Headers' anonymous-only rule). For the framework,
      optional: serve a public screen's `.qvue` without a session, as a cacheable asset.
    - **F73** ProductDetail's "Ask a question" (F67's first item) is not built: it needs the Forum's `publish#Post` to
      take a product (check it public, link `CommunicationEventProduct`) and a setting naming the site's product category,
      neither of which exists. For the lead: build it with the Forum's owner (a Forum change) or move it to P6/P9.
    - **F74** No job retires expired open carts (design-shop §7.1's retention): an expired access reaches nothing,
      but its order stays open. For P8 (operations).

- **Review Nov 6 (P4)** (Mantle and mr-pass; branch `shop/p4`). Checked: StoreCartAccess (only the capability's digest,
  unique; the token only in the presentation session under `passShopCart:{siteId}`, never in a page, cookie or URL of the
  browser; 48 random characters; lookups, creation and code tries throttled by `requesterKey`, which is the remote
  frontend's `passRequester` for a registered client); a cart reached only by a usable row of the facade's site, store and
  currency (open order, not expired or retired, an account's cart only for that account) or the signed-in account's own;
  no operation takes an order id; lines only through `lineOf` of the cart's own product lines; the anonymous first
  `addCartItem` (F44) needs a registered client at the authority (PassAuthority, PassApi) and makes a new cart each time
  (it cannot write into another), bounded by the creation throttle; inputs allow-listed in Schema.js and each line's
  `unitAmount` the authority's price, which Mantle then keeps (`isModifiedPrice` Y; `handle#OrderMajorChange` deletes and
  re-applies promotion items only and `recalc#OrderPartItemAmounts` has no caller, so nothing reprices or double-counts);
  `extras` under `storeAuthority` only (set only by `get#StoreProductPrice`), `get#ProductPrice` unchanged; revisions
  required on changes, replays keyed by the cart and checked before the revision; merges of proven same-scope carts
  only, refused with a payment in progress, the guest access retired and its order cancelled; merge#Parties moving the
  access by party only; `get#ProductImage` (public product in the routed store, image types and extensions, the row's
  store, nosniff and attachment, the location staff-entered, never the visitor's); code refusals all
  `PROMO_CODE_INVALID` (Mantle's own refusals are warnings, so the uniform text holds); `Portal.attempt`'s new
  transaction (the facade call suspends the transition's and commits or rolls back alone); islands (plain forms without
  JS, the form token as `X-CSRF-Token` from `Cart/state`, same-origin). Fixes:
  - R1 (medium) Account.js's sign-in and sign-out hooks called `attachCart`/`releaseCart` in the sign-in's transaction,
    so a refusal (a throttled lookup, an unexpected error) marked it rollback-only (F69) and could fail the sign-in
    despite the catch; both now run in their own transaction (ShopCart.js `signedIn`, `signingOut`).
  - R2 (low) `simpleQuery` escaped `<` and `>`, which a query_string cannot escape (a bare `>10` is a range); they
    become spaces (ShopCatalog spec gains the check).
  - R3 (low) Attaching a guest cart at sign-in changed the part's customer without re-applying promotions, so the
    account's promotions (or a guest's that no longer apply) waited for the next change; it now calls
    `handle#OrderMajorChange`.
  - R4 (acceptance) ShopMount and ShopThemeRelease now stand in any order with ShopFixtures: ShopMount sets aside the
    site's theme binding (and keeps the Shop mount's id in its save) and puts it back; ShopThemeRelease retires
    POPC_DEFAULT's published products for its empty-state features and restores them.
  - Specs after the fixes: Mantle ShopCart, ShopCatalog, PassAuthority, StorePromotions, Promotions 28 passed; mr-pass
    ShopCart, ShopAccess, ShopCatalog, Portals, Transport, PublicIdentity, SsoHandoff 22 passed; acceptance
    ShopFixtures, ShopMount, ShopThemeRelease 8 passed; `./moq accept mr-pass`: server suite 14 passed, 3 ignored, 0 failed; client suite 40 passed.
  - For the lead: (1) `store#Mounts` (Forum.js) deletes and recreates every mount a save names, so re-saving a site's
    Shop mount that has a theme binding fails with a raw foreign-key error (Unavailable), and the mount's id changes
    unless the page sends it (StoreCartAccess.appMountId has no foreign key, so carts survive but name an old id); since
    P2. (2) F69 stands for Billing's and Support's page writes. (3) A remote `getCart` is a GET, so the capability
    travels as a query parameter on the frontend-to-authority link (as the existing token reads do) and may reach the
    authority's access logs; consider a POST or a header for capability reads. (4) Product images are no-store and read
    any location scheme a staff member enters; consider public caching by generation and limiting the schemes.
    (5) Guest parties and cancelled guest orders accumulate with no retention job (F74).

### P5 — Checkout and payment

Design-shop §6 Checkout, PaymentResult and OrderConfirmation, §7.2–§7.3, §8; SHOP-CHECKOUT, SHOP-PAYMENT.

- **`StoreCheckout`** (`mantle.order`; states as StatusItems) and **`mantle.order.ShopCheckoutServices`** (X): begin,
  get and resume; contact; addresses, with `validate#PostalAddress` through the store's carrier gateway offering a
  correction; delivery quotes over `get#StoreShippingOptions`, `get#OrderShippingRatesBulk` and Commerce P6's local
  rates; tax by `calculate#OrderSalesTax`; payment options from the store's gateways and their capabilities; review with
  the terms version of Commerce P4's policy page; freeze under lock (stock policy, publication, prices, quotes, Commerce
  P7's promotion limits), the snapshot bound to the frozen `orderRevision` and committed before any provider call;
  submit; one placement with durable intent; complete.
- **Accounting's coordinator** (AC-02, X9; impl-commerce §4; F13 here): `PortalPaymentAttempt` gains its purpose
  (invoice, shopCheckout, shopRenewal, eventRegistration), the order, checkout or occurrence, store and site, snapshot
  hash, phase and safe outcome; each worker selects its purpose; Billing's invoice attempts and URLs are unchanged.
  Provider callbacks are SystemMessage receipts into one reconciliation with polling.
- **The adapter** (F14; the user's call, impl-commerce §4): Authorize.Net Accept Hosted, with the canonical return address,
  the attempt's `operationKey`, the outcome looked up by the authority and a profile saved for a signed-in buyer who
  asks; the test gateway's hosted outcome for the specs.
- **Mantle conditions** (design-shop §8.3, crosscut §1.3): `authorize#OrderPayments` skips a Promised payment with an
  unresolved attempt (impl-commerce F32); placement never authorizes twice.
- **`OhtPayment`** (X4, F15): the hold type, its release permission `PAYMENT_HOLD_RELEASE` seeded in mr-mantle with its
  ADMIN grant and granted in BOSS to Accounting's treasury group; reconciliation places it when a capture fails or an
  amount or account mismatches after placement. Chargeback intake is Accounting's (§7).
- **ExternalAccess `SalesOrder`** (X6, F16): the customer-direction record kind with the OrderView scope (and Download and
  RenewalAction for P6 and P7), for the guest's order link.
- **Operations:** `beginCheckout`, `getCheckout`, `resumeCheckout`, `setCheckoutContact`, `setCheckoutAddresses`,
  `getDeliveryOptions`, `selectDelivery`, `getPaymentOptions`, `selectPayment`, `submitCheckout`,
  `getCheckoutPaymentResult` and `getOrderConfirmation`.
- **Jobs:** checkout expiry and attempt reconciliation, bounded with backoff, each attempt in its own transaction, with
  `operation` marks; readiness flags the reconciliation and polling jobs when they are paused (F13).
- **Pages:** Checkout (Contact, Addresses, Delivery, Payment, ReviewPurchase; trusted Vue enhancement of plain forms);
  PaymentResult (bounded polling, the provider's link); OrderConfirmation (the QR of the signed-in order page). No
  marketing opt-in (impl-commerce §4).
- **Specs:** Mantle `test/order/ShopCheckout` (a changed price gives reviewRequired; a double submit makes one order; an
  unknown outcome stays unknown with no new key; a failed placement after the provider's success keeps the evidence; a
  promotion limit at freeze; a zero total skips the gateway) and `test/account/PaymentAttemptPurpose` (Billing's worker
  never touches a Shop attempt and the reverse; the hold and its release permission); mr-pass `ShopCheckout`. Shop's one
  golden-path client walk, `test/client/Shop/ShopCheckoutWalk` (impl-commerce F44), starts here: browse, add to the
  cart, check out through the test gateway's hosted page, and see the confirmation.
- **Usable when** (design-shop §18.1 "Price, stock, address and promotion changes", "Duplicate submit, crash and
  callbacks", "Unknown provider outcome", "Failed placement after provider success", "Payment exception after
  placement", the last shown in Commerce from its P8): a guest checks out a physical item
  through the hosted page and returns to the confirmation; a price changed during checkout asks for review; a second
  submit answers the first order; an unknown outcome stays processing across a refreshed frontend and is reconciled by
  the lookup; a capture failure after placement holds the order, which Commerce shows and Accounting releases.

- **Built (Mantle, mr-pass and BOSS), Nov 6, 2026** (branch `shop/p5`):
  - Records: `mantle.order.StoreCheckout` (`entity/ShopCheckoutEntities.xml`: the cart access, order, site, mount, store and
    currency, the StoreCheckout status (ScoEditing, ScoReady, ScoReviewRequired, ScoPaymentPending, ScoPlacementPending,
    ScoCompleted, ScoExpired, ScoCancelled, with their flow), the policy it began under, the contact, the delivery and
    billing addresses with a carrier's offered correction, the chosen quote (carrier, method, amount, the revision it holds
    for and its expiry), the payment option and the save-card ask, the terms version accepted, the frozen revision, snapshot
    and hash, the due amount, the current attempt's payment, the return reference with its key's digest, what changed at the
    last freeze (`reviewJson`), the placement intent, tries, date and failure, and the guest's order capability).
    Accounting's coordinator (AC-02, X9, F13): `PortalPaymentAttempt` gains `purposeEnumId` (PaymentAttemptPurpose:
    PapInvoice, also for an empty one; PapShopCheckout, PapShopRenewal, PapEventRegistration), the order, checkout,
    occurrence and store, the snapshot hash, phase, safe outcome and the lookup's count, last and next check;
    `PaymentGatewayResponse` gains `hostedFormDate` and `networkTransId` (F41). `OhtPayment` (enumCode
    `PAYMENT_HOLD_RELEASE`, F15) in OrderHoldEntities; `data/ShopCheckoutSetupData.xml`: the permission with its ADMIN grant
    and the jobs `reconcile_StoreCheckouts` (every five minutes) and `expire_StoreCheckouts` (hourly).
  - `service/mantle/account/PaymentAttempts.js`: the typed coordinator (create, the due attempts of a purpose with bounded
    backoff, the state of an attempt's payment, the provider action, a lookup in its own transaction named to the posting
    guard as Billing's are). Portal.js (Billing): its attempts are PapInvoice, and its job, refresh, result and pending
    attempts select that purpose only; its URLs unchanged.
  - `mantle.order.ShopCheckoutServices` over `service/mantle/order/ShopCheckout.js`: `begin#`, `get#`, `resume#Checkout`,
    `set#CheckoutContact`, `set#CheckoutAddresses` (fields, an own saved address, or the offered correction through the
    store's validating shipping gateway, `validate#PostalAddress`, never applied unasked; the store's destinations),
    `get#DeliveryOptions` and `select#Delivery` (`get#StoreShippingOptions` with rates; a method with no quote is not offered,
    impl-commerce F79; the part's carrier and method, `calculate#OrderShipping`, then `calculate#OrderSalesTax`),
    `get#PaymentOptions` and `select#Payment` (the store's gateways with a hosted page, `gatewayCapabilities`),
    `submit#Checkout`, `get#CheckoutPaymentResult`, `get#CheckoutPaymentForm` and `get#OrderConfirmation`; the jobs
    `reconcile#Checkouts` and `expire#Checkouts`; `check#CaptureOutcome` (SECA `ShopCheckoutCaptureHold` on
    `capture#SinglePayment`); the internal `run#Step`, each step in a transaction of its own. Submit: the delivery re-quoted
    outside any lock, then the freeze under the order's and checkout's locks (lines public and purchasable at the authority's
    price, a changed price repriced on its line; Commerce P7's promotion limits with `lock: true`; the fresh quote; the tax;
    the terms version), a change committed as reviewRequired with what changed (REVIEW_REQUIRED, Conflict), else the
    snapshot and hash bound to the frozen `orderRevision` committed with the promised payment (`add#OrderPartPayment`) and
    its PapShopCheckout attempt; then `authorize#SinglePayment` with `operationKey` `shop-auth-{paymentId}` and the canonical
    return address `{mount}/Checkout/return?ref=&key=` in a transaction holding the payment only. The result is looked up by
    the reference and key (a page's reads at most every second; the provider's return, `returned`, at once); an approved
    payment commits the placement intent, then `place#Order` once in its own transaction (a crash after it is read back
    from the order's status); a failure keeps the payment and attempt (placementPending with its failure, five tries, the
    job retrying); a declined, cancelled or failed attempt opens the checkout again (a new attempt is a new payment, the
    outcome being known); an unknown or pending one stays, and a second submit answers it. Nothing due: no payment, placed
    by the submit. A guest's first confirmation issues the `SalesOrder` OrderView capability once (`orderToken`); the QR is
    of the signed-in order page. A signed-in buyer's kept card is saved after the approval through the gateway's hosted
    profile service. Each write takes an `operationId` (PostingOperation `ShopCheckout`; the return key and tokens are never
    kept in it); contact, delivery, address and submit check the revision.
  - Mantle conditions (each acting only on what Shop makes): `authorize#OrderPayments` skips a promised payment with an
    unsettled PortalPaymentAttempt (F32); `get#SinglePaymentGatewayDetails` looks up a promised payment with no reference
    whose latest authorization answer is `HostedPending` (Accept Hosted; F38), as before otherwise; `hold#Order` takes an
    OhtPayment reason from the reconciliation without a user's permission, as OhtCredit from the credit policy (released only
    with `PAYMENT_HOLD_RELEASE`).
  - The adapter (F14, F37-F41): `AuthorizeNetServices.authorizeHosted#Payment` and `authorizeAndCaptureHosted#Payment`
    (nothing sent; the payment waits at the hosted page), `get#HostedPaymentForm` (a fresh `getHostedPaymentPageRequest` token
    per visit with the reference in `refId` and `order.invoiceNumber`, the canonical return and cancel addresses, the receipt
    and the merchant's name; never stored), `store#HostedPaymentProfile` (the transaction's profile, else
    `createCustomerProfileFromTransactionRequest`); the details lookup finds a waiting payment's transaction by its reference
    and keeps its amount and `networkTransId`, and cancels it once nothing is found and no token can still be used; a webhook
    of a transaction with no reference match is matched to a waiting payment by `merchantReferenceId` or, from
    `getTransactionDetails`, its invoice number (F39). `gatewayCapabilities` (StoreCheckout.js): PgtAuthorizeNet hosted with
    an `*Hosted#Payment` service, its form and profile services; readiness gains `hostedPayment` and `checkoutJobs`
    (StoreAdmin.js's table). ExternalAccess.js: the `SalesOrder` kind (OrderView, Download, RenewalAction; a placed order of an
    internal vendor to an outside customer; self). ShopCart.js: a submitted checkout holds the cart (CHECKOUT_PENDING), and
    its helpers are exported for the checkout. ThemeView.js: the `checkout` page kind's store view.
  - F75 follow-ups: `store#Mounts` (Forum.js) keeps an existing mount's row (by its id, else the same app and path, else the
    app) instead of deleting and recreating it; `getCart` and every checkout read are POSTs (Routes.js and its mirror), in
    the three `TOKEN_WRITES` lists, and Transport's `routeOf` takes a checkout's key or an order link as the capability (and
    an anonymous `getCart`). F71: a sign-in with no return path lands on the site's root app (Account.js `landing`, in Login,
    SecondFactor, Sso and Register).
  - PASS operations `beginCheckout`, `getCheckout`, `resumeCheckout`, `setCheckoutContact`, `setCheckoutAddresses`,
    `getDeliveryOptions`, `selectDelivery`, `getPaymentOptions`, `selectPayment`, `submitCheckout`,
    `getCheckoutPaymentResult`, `getCheckoutPaymentForm`, `getOrderConfirmation` (`shop/checkout...`, `shop/orders/confirmation`)
    in Schema/Routes and the mirrors (identical) and `Contracts.d.ts` (CheckoutView, CheckoutAttempt, OrderConfirmation).
  - mr-pass pages: `screen/Shop/ShopCheckout.js` (the return keys and a guest's order links kept in the server session under
    the site, never in a page or URL it makes); `Shop/Checkout.xml` (transitions `begin`, `contact`, `addresses`, `delivery`,
    `payment`, `submit`, `resume`, `return`, `enhance`), `Shop/PaymentResult.xml` (`state` for the polling),
    `Shop/OrderConfirmation.xml`, `Shop/PaymentRelay.xml` and `Shop/CheckoutPage.html.fancy`; each renders through the active
    release's `checkout` page kind with the `shop.checkout` component, or in the PASS shell, and redirects in `pre-actions`.
    The steps are plain forms with the revision and an operation id; PaymentResult links the provider's page (the relay for
    Accept Hosted) and polls with backoff (about two minutes) through the same-origin `Checkout/enhance` script, which also
    posts the relay's form; OrderConfirmation shows the order, its payment and delivery, the QR (`ec.resource.barcodeSvg`) and
    the next steps. Headers.js: `PaymentRelay` alone adds `form-action https://accept.authorize.net https://test.authorize.net`.
    The Cart's BeginCheckout (Check out, or the checkout in progress) in the plain page and Cart.qvue.
  - BOSS: `PAYMENT_HOLD_RELEASE` granted to `BOSS_ACCOUNTING_TREASURY` (BossAccountingSetupData.xml); AccountingAccess +1
    feature (treasury holds it, AR does not); CommerceStores' readiness expectation now two findings (the demo store's card
    gateway has no hosted page, F79).
  - Specs: Mantle `test/order/ShopCheckout` (5 features, 2.6 s: a guest's physical checkout through the hosted page, frozen
    with one promised payment and its PapShopCheckout attempt, a replay and a second submit answering the first, the
    return's lookup placing once, a wrong key reaching nothing, the cart's access retired, the confirmation with the order
    link once and by it; a changed price reviewRequired and the resubmit at the new revision; an unknown outcome staying
    unknown across lookups with one authorization and one idempotency key; a placement failing after the provider's success
    keeping the payment and attempt, placed later by the job; a promotion limit at the freeze, and nothing due skipping the
    gateway); `test/account/PaymentAttemptPurpose` (4 features, 0.3 s: Billing's job, refresh and result never touch a Shop
    attempt and Shop's job never an invoice one; authorize#OrderPayments' skip and its unchanged default; the hosted-pending
    lookup and its unchanged default; the Payment hold placed without a permission, released only with it, and a failed
    capture holding only a Shop payment's order); `test/ext/AuthorizeNetGateway` +1 (Accept Hosted: nothing sent at
    authorization, the form request, the webhook matched by invoice number and the lookup by reference keeping the amount and
    network transaction id; 0.03 s). mr-pass `test/Shop/ShopCheckout` (3 features, 0.6 s: the checkout page's one render
    through the starter; the relay's CSP alone allowing the provider; the checkout operations in the three lists and POSTs,
    `getCart` too; a remote frontend's checkout, stale refusal, submit and a return read by reference and key equal a local
    page's; F71's landing). The golden-path client walk `test/client/Shop/ShopCheckoutWalk` (1 feature, 4.1 s, at 390 px on
    `test/Shop/ShopWalkFixtures`' Shop of PASS_HTTP: product, cart, checkout, the hosted test page, the confirmation with
    its QR), in the client suite after PortalHttp. Also run, all pass: Mantle AccountingPortals, ShopCart, StoreCheckout,
    StoreAdmin, OrderToCashBasicFlow, PassAuthority, ThemeAuthoring, SupplierPortal, ShopCatalog, PaymentGateway,
    AccountingPaymentGateway, PurchaseHoldPermission, OrderChanges, StorePromotions, GatewayContracts, SitePages,
    SupportPortal (153 features); mr-pass ShopCart, ShopAccess, ShopCatalog, ShopThemes, ShopPreview, Portals, Transport,
    PublicIdentity, SsoHandoff, Forum, ForumAccess, SupportAccess, SupplierPages, Integrations, Operations (79 with
    ShopCheckout); mr-boss AccountingAccess, CommerceAccess, CommerceStores, CommerceCheckoutSettings, CommerceSitePages,
    AccountingPayables, CustomerServiceKnowledge, CommercePromotions.
    `./moq test-apps`: the server suites 3201 of 3202 passed (mr-mantle 368.4 s of 370, mr-boss 251.8 of 264, mr-pass 18.7
    of 17, over but under 1.5 times), the one failure MantleSearch's limited universal search (both totals at the query's
    100 limit), which passes alone and with P5's Mantle specs (for the lead: likely the full run's data volume); the client
    suites 17 passed (mr-pass 8.2 s of 6, F84).
  - Acceptance: `acceptance/ShopPaymentScenarios` (5 features, local and remote: a price changed during checkout asks for
    review and a second submit answers the first order; an unknown outcome stays processing for a refreshed frontend (the
    reference and key only) and the job finishes it once the provider answers; a capture failing after placement holds the
    order and the payment operator releases it) and `acceptance/client/ShopCheckoutHttp` (1 feature: at 390 px on ZIZI_SHOP a
    guest checks out Demo Product One-One with an address, a delivery option, the hosted test page and the terms, back to the
    confirmation, no overflow); ShopFixtures gains ZIZI_SHOP's hosted, lost-answer and capture-declining test gateways
    (POPC_DEFAULT's card gateway the hosted one), the terms page and a guide. `./moq accept mr-pass` once: server suite 20
    passed, 3 ignored, 0 failed; client suite 41 passed. The remote half runs through PassAuthority (the authority side of
    both transports); Deployment.md's two-runtime check and gRPC not run.
  - Lint: `moqui lint --screens` 132 sites as before, none in the Shop, Account or Shared files.
  - Docs: mr-pass Deployment.md "Checkout and payment"; mr-mantle docs/AuthorizeNet.md's Accept Hosted.
  - Inventories: not edited here (F59: the lead updates them at the finish).
  - Decisions: the provider is asked only in a short transaction that holds the payment alone (Mantle's gateway path, as
    poll#PaymentGatewayDetails), never while the checkout, cart or order is locked; placement follows an approved payment (an
    authorization or a sale), and an amount the provider reports that differs places and holds the order (OhtPayment) rather
    than refusing it, so the money and the order stay together for Accounting; the checkout's reference with its key is the
    narrow capability (in the return address, as Billing's, readable for a day after completion); a guest's order link is
    the SalesOrder capability issued at the first confirmation (P6 mails it); a page's first result read waits a second after
    the authorization and the provider's return (`returned`) looks up at once; a declined attempt reopens the checkout with
    a new payment next time; reads are POSTs listed with the token writes; OhtPayment is placed by the reconciliation alone.
  - Findings (provisional):
    - **F76** Mantle's `check#AvailableInventory` checks stock of every product in a store that requires inventory,
      digital ones too, so POPC_DEFAULT cannot cart a digital item (the acceptance scenarios use Demo Product Three-One). For
      P6 (digital delivery): a product-type condition, with its spec.
    - **F77** The test gateway's `alwaysApprove#PaymentDetails` approves on any lookup, before the payer has visited the
      page; hence the result's one-second pause after the authorization, and the specs' clearing of `lastCheckDate`.
    - **F78** A screen's `actions` run after the PASS shell's header is written, so a redirect from them is lost (the
      page stops after the header); the checkout pages redirect in `pre-actions`.
    - **F79** Commerce's demo binds POPC_DEFAULT's card payments to TEST_APPROVE, which has no hosted page, so the BOSS
      demo cannot check out and the store's readiness names it. For Commerce's demo (mr-boss Demo.js): a hosted gateway
      (the test gateway's `hostedPending`, as ZIZI_PORTAL_HOSTED, or the Authorize.Net sandbox with `authorizeHosted#Payment`).
    - **F80** Billing with Accept Hosted would need Billing's own relay (its `redirectUrl` is a GET link); Billing keeps
      the test gateway's hosted redirect.
    - **F81** The checkout steps are plain forms: design-shop §6's trusted Vue enhancement of them is not built, and
      PaymentResult polls with a small same-origin script, not a Vue component (design-shop §6 changed).
    - **F82** The confirmation's QR names `{mount}/Orders/{orderId}`, P6's signed-in order page, and the SalesOrder kind's
      link page `/Orders/Status?token=` is P6's; ExternalAccess `create` finds no site for the `shop` kind (its mount's target
      is a store, not an organization), so the capability's url is null until P6 gives Shop its link.
    - **F83** No spec covers address validation's offered correction (no validating gateway in the tests), the saved card
      (`store#HostedPaymentProfile`), or an amount mismatch (the test gateway reports the payment's amount).
    - **F84** The golden-path walk puts mr-pass's client suite at 8.5 s of its 6 s budget (under 1.5 times); raise it by
      the measured share with the user's agreement (impl-commerce §4).

- **Review Nov 6 (P5)** (Mantle, mr-pass, mr-boss; branch `shop/p5`). Checked: the submit path end to end (the quote
  outside any lock; the freeze under the checkout's and order's locks committed with the snapshot, the promised payment
  and its PapShopCheckout attempt before any provider call; `authorize#SinglePayment` with `shop-auth-{paymentId}`, which
  for a hosted gateway sends nothing; the lookups, the form token and the profile save each through `requireNewTransaction`
  with nothing of the checkout, cart or order locked, as Billing's resolve job and `poll#PaymentGatewayDetails` do: the
  worker's interpretation of "no gateway call inside an open transaction" holds, the caller's suspended transaction holding
  no lock); placement intent then `place#Order` once under the checkout's lock, a crash read back from the order's status;
  double submit and two tabs (the second freeze waits on the lock and answers the first attempt); a replay by operation id;
  an unknown outcome (no new key; `authorize#OrderPayments`' F32 skip, its default specced); a placement failing after
  approval (the payment and attempt kept, the job's bounded retries); the capture SECA holding only a Shop payment's placed
  order; `hold#Order`'s OhtPayment exemption (as OhtCredit's: every in-process caller names its own hold type, none takes
  one from a request; `allow-remote` false) and its release only with `PAYMENT_HOLD_RELEASE` (ADMIN, BOSS treasury);
  `get#SinglePaymentGatewayDetails`' HostedPending lookup (only Authorize.Net writes that status; the default specced);
  Billing (Portal.js selects invoice attempts, or those with no purpose, in its job, refresh, result and list; URLs
  unchanged; AccountingPortals and Portals pass); Accept Hosted (the token never stored, the relay a GET with no-store and
  the only route whose CSP adds the provider's form-action, the webhook through the framework's signature check and matched
  by `merchantReferenceId` or the invoice number, the amount and `networkTransId` kept, the profile saved only for a
  signed-in buyer who asked); the freeze checks and reviewRequired; a zero total skipping the gateway; the jobs (bounded,
  backoff, one transaction per step, failures named); the return reference with its key's digest (the key never kept);
  the SalesOrder kind (a placed order of an internal vendor to an outside customer); F75 `store#Mounts` (Forum,
  ForumAccess, Portals pass). Fixes:
  - R1 (high) Accept Hosted lets a payer try again on the page after a decline, but the first lookup that found the
    declined transaction made the payment Declined and reopened the checkout, so a later approval with the same reference
    was never looked at (no Promised payment to match) and the shopper's next submit charged a new payment. A declined
    transaction is now final only once no form token can be used (15 minutes and the grace after the last form); after
    that the reference's newest transaction (the lists, newest first) decides (AuthorizeNet.js `hostedDetails`,
    `findByReference(..., newest)`; AuthorizeNetGateway +1 feature).
  - R2 (high) Placement did not check that the order was the one frozen and paid for: a cart write that raced the submit
    (its `editable` check before the freeze, its change after) or a staff edit changed the order after the snapshot, and
    `handle#OrderPartChange` moves a single promised payment's amount with the part's total, so the hosted page would
    charge the new amount and the changed order be placed. Now ShopCart's `editable` takes the order's lock, the freeze
    checks the shopper's revision again under its lock (STALE_REVISION), `getCheckoutPaymentForm` refuses a payment whose
    amount is no longer the frozen one (ORDER_CHANGED), and placement refuses an order whose revision or total is not the
    frozen one (ORDER_CHANGED, kept placementPending with the payment for staff; ShopCheckout +1 feature).
  - R3 (low) A submit that lost the freeze race answered a new `returnKey` whose digest was never kept; the PASS session
    kept it over the first submit's key under the same reference. It now answers the first attempt (`alreadySubmitted`)
    with no key.
  - R4 (low) Two first confirmations of a guest's order (two tabs) could each issue an order link; the issue now takes the
    checkout's lock.
  - R5 (F79, resolved) The Commerce demo binds POPC_DEFAULT's card payments to `BOSS_COM_HOSTED` (BossCommerceDemoData.xml),
    a test gateway with Mantle's new `hostedPendingOrApprove#PaymentAuthorization` (a payment with a payment method approved
    as TEST_APPROVE, one without waiting at the hosted page) and `hostedOnlyApprove#PaymentDetails` (approves only a hosted
    payment, answers nothing for another), so the BOSS demo checks out and Mantle's POPC_DEFAULT specs are unchanged
    (OrderToCashBasicFlow, ReturnToResponseBasicFlow, RestApiTests, AssetReservationMultipleThreads pass);
    PaymentAttemptPurpose +1 feature; CommerceStores' readiness back to one finding, CommerceCheckoutSettings and the
    acceptance CommerceCheckoutWalk name the new binding.
  - Specs after the fixes: Mantle ShopCheckout (6), PaymentAttemptPurpose (5), AuthorizeNetGateway (17) and OrderToCashBasicFlow,
    ReturnToResponseBasicFlow, RestApiTests, AssetReservationMultipleThreads, StoreCheckout, StoreAdmin, AccountingPortals,
    PaymentGateway, GatewayContracts, AccountingControls, ShopCart, PurchaseHoldPermission, OrderChanges, StorePromotions,
    PassAuthority, SitePages, SupportPortal, AccountingPaymentGateway, ShopCatalog, ThemeAuthoring, SupplierPortal: 250
    passed; mr-boss CommerceStores, CommerceCheckoutSettings, CommerceAccess, AccountingAccess, CommerceSitePages,
    AccountingPayables, CustomerServiceKnowledge, CommercePromotions 43 passed; mr-pass ShopCheckout, ShopCart, ShopAccess,
    ShopCatalog, ShopThemes, ShopPreview, Portals, Transport, PublicIdentity, SsoHandoff, Forum, ForumAccess,
    SupportAccess, SupplierPages, Integrations, Operations 79 passed; client suite (PortalHttp, ShopCheckoutWalk) 4 passed;
    acceptance ShopPaymentScenarios (with ShopFixtures) 8 passed, CommerceCheckoutWalk 4 passed.
  - R6 (low; the worker's test-apps failure) MantleSearch's limited universal search: a full mr-mantle run on master
    passes (1825 features) and on this branch failed (1837 of 1838), so the branch's records cause it, not the run's
    volume in general: a one-sided finance reader's total is the authorized page (F439, F446), and the branch's added
    Ziziwork Retail payments fill the page of 100, so the limited total equals the administrator's (both 100). The spec
    now asks for a page of 500 (MantleSearch.spec.js); full mr-mantle run after it: MantleSearch passes, 1837 of 1838 (the one failure an assertion of
    this review's new ShopCheckout feature, fixed; ShopCheckout and MantleSearch then 14 passed).
  - For the lead: (1) Two hosted pages open at once (two tabs' relays before either payment is looked up) can each take a
    payment under one reference; the lookup finds one, and Authorize.Net's duplicate window covers only the same card and
    amount within it. Consider refusing a new form token once the reference has a transaction, and flagging a reference
    with more than one approved transaction. (2) The return address carries the reference and key, so the provider and
    the browser's history hold the key: for a day after completion it reads the checkout (the guest's own contact,
    address and lines), the first confirmation read by it issues the guest's order link (issued once, so a reader before
    the guest gets it; P6 mails a link), and `resume#Checkout` by it after a decline hands over a new cart capability.
    Consider issuing the order link only to the cart's session and dropping the cart hand-over from the reference.
    (3) Design-shop §8.2 says an amount mismatch "remains an exception, not a successful payment"; the worker places and
    holds (OhtPayment), which keeps it an exception while the money and order stay together; currency and merchant account
    are not compared (the token request sets both). Confirm. (4) A declined Accept Hosted payment now shows as pending for
    up to the token's 15 minutes (the payer can pay again through the relay meanwhile); a shopper who wants another way to
    pay waits that long. (5) A placement refused as ORDER_CHANGED, or past its five tries, stays placementPending with an
    approved payment and nothing shows it to staff yet (Commerce's P8 exceptions list).

### P6 — Orders, account and digital delivery

Design-shop §9, §10 Downloads and §11's delivery; SHOP-ACCOUNT, SHOP-DIGITAL, SHOP-SUPPORT's order requests, CX-DELIVERY.
Stage C2/S2 ends with Commerce P11.

- **`mantle.party.ShopCustomerServices`** (A): `get#Account`, `find#Orders`, `get#Order`, `get#OrderDocument`,
  `preview#Reorder`, `reorder#Order`, the addresses (`get#`, `store#`, `end#Address`) and payment methods (`get#`,
  `begin#`/`finish#PaymentMethodSetup` through the provider's hosted setup per P0, `end#PaymentMethod` naming the
  contracts it affects); ownership by Customer Service's self relationship or the `SalesOrder` capability, never a
  browser party ID.
- **Support from Shop** (F26, F27, F35; §4): OrderDetail's Request a return, Ask a question and Request cancellation
  link the site's own Support pages with the order (RequestReturn, and NewCustomerCase with its `cancelOrder`), the
  Support mount targeting the store's organization (Commerce P6's readiness); the receipts link them too. The owner
  contract, written into design-customer-service §8: Customer Service's `request#CustomerReturn`, `create#CustomerCase`
  and `request#CustomerCancel`, and the Support pages, admit the `SalesOrder` OrderView capability for its one order as
  they admit a contact or the self relationship, the capability carried to the page by its token route; and
  `contactCase` sets `Request.productStoreId` from the order's store (impl-commerce F37).
- **The PASS Account hub and email preferences** (F6; X6, X15; owner contract, unless Customer Service P15 built them):
  `Account/Home` with a card registered by each app (Shop's AccountOverview summary, Billing's, Support's) and
  `Account/EmailPreferences` combining list unsubscribe over ConsentServices' tokens, topics and the Forum opt-out;
  ConsentServices' unsubscribe link goes to the recipient's site page when there is one. Customer Service P15 built
  neither (F6). Among the topics is each store's "cart reminders", which a signed-in customer turns on with
  `store#PartyConsent` and Commerce P10's recovery requires (§4).
- **Digital delivery** (F22): `StoreItemFulfillment` (`mantle.product.store`) drives an approved digital order part:
  the invoice through an internal Mantle service split from `create#InvoiceFromSource` under fulfillment's own entry
  point, capture, finalization (the invoice-finalized email is the receipt), `checkComplete#OrderPart`, then a
  `StoreDownloadGrant`, each step resumable by its marker; `OrderApprovedSendEmail` does not run for an all-digital
  order. `ShopFulfillmentServices` (D) `get#Downloads` and `issue#Download`: a short-lived scoped capability, range
  requests, streaming through a remote frontend.
- **The delivery ledger** (X8, CX-DELIVERY; owner contract, F24): Comms' Mantle attempt and receipt ledger generalized
  from ForumDelivery (event, recipient, channel and template key, consent snapshot, outcome) over `send#EmailMessage`'s
  outcomes and the SystemMessage retry jobs. Its first source is the download-ready notice; the review request
  (Commerce P9), recovery (P10) and renewal notices (P7) follow. The existing store emails keep their senders (§4).
- **Refunds** (§4): `reconcile#RefundedItem`'s download half, with the SECAs `PaymentRefundedReconcileAccess` and
  `ReturnSettledReconcileAccess` (crosscut §1.3): a refunded or returned digital item ends its StoreDownloadGrant, so
  S2 serves no unpaid download; P7 adds the paid-access half.
- **Merges** (F23): StoreDownloadGrant follows `merge#Parties` by rule (StoreCartAccess's is P4's), and a merge never
  moves purchase access on email alone.
- **Operations:** `getShopAccount`, `findShopOrders`, `getShopOrder`, `getShopOrderDocument`, `previewReorder`,
  `reorder`, `getAddresses`, `storeAddress`, `endAddress`, `getPaymentMethods`, `beginPaymentMethodSetup`,
  `finishPaymentMethodSetup`, `endPaymentMethod`, `getDownloads` and `issueDownload`.
- **Pages:** AccountOverview, Addresses, PaymentMethods, Orders, OrderDetail (OrderSummary, Shipments,
  PurchaseDocuments, Reorder, OrderActions), Downloads; the hub's Shop card; EmailPreferences' store topics.
- **Specs:** Mantle `test/party/ShopCustomer` (own orders by self or capability, another's refused alike; reorder
  reprices; addresses owned), `test/product/StoreFulfillment` (no grant before capture; resumed after a crash between
  invoice and grant; a refund ends the grant), Customer Service's `test/request` specs (+1 feature: a case, return and
  cancel request by the `SalesOrder` capability, another order's refused) and `test/party/DeliveryLedger` (one notice
  per event and recipient, the consent snapshot, an uncertain send kept for review); mr-pass `ShopAccount`.
- **Usable when** (design-shop §18.1 "Mixed physical/digital purchase", "Protected download", "Account/payment
  self-service", "Reviews and support" its support half (reviews are Commerce P9), "One account"):
  - a guest buys a physical and a digital item; the digital part is invoiced and captured, the receipt and the
    download-ready notice arrive, and the guest's link downloads only that file; the physical part ships on its own
    invoice policy;
  - the guest registers with the purchase email and verifies it, and the hub shows the order, its invoice in Billing
    and a case filed from it in Support; an unverified account sees none of them;
  - a guest's return request and question from OrderDetail, by the order link, are a ReturnHeader in ReturnRequested
    and a case in the store's queue carrying the store; a cancel request shows "Cancellation requested" unless Customer
    Service's flag applies it at once;
  - a signed-in buyer adds a payment method through the hosted setup and an address, and ending the method names the
    contracts it affects; refunding the digital item ends its download.

- **Built (Mantle, mr-pass and BOSS), Nov 6, 2026** (branch `shop/p6`):
  - P5 review's open items first (F85, F83): Accept Hosted issues no new form token once the reference has a transaction
    (paid, declined or held; a search that cannot tell issues none), and a second approval under one reference is flagged
    on the payment (`DUPLICATE_APPROVAL`, the other transaction ids) and holds the placed order (OhtPayment, the attempt's
    outcome `exception`) as an amount mismatch does (AuthorizeNet.js `referenceTransactions`, `flagDuplicates`;
    ShopCheckout.js `duplicateApproval`). The reference and key read only the checkout's state, due amount and attempt
    (`referenceView`) and the order's reference and state (a minimal confirmation); the guest's order link is issued only to
    the cart's own session (its capability, live or of the placed cart: `reach` names it `placedCart`); `resume#Checkout`
    hands no cart capability to the reference. Specs: ShopCheckout +1 feature (an amount mismatch holds the order; a signed-in
    buyer's kept card through the test gateway's hosted profile), its first feature reads the confirmation by the reference
    (minimal, no link) and by the session (the link once); AuthorizeNetGateway +1 (a used reference gets no form; a second
    approval is flagged).
  - Records: `mantle.product.store.StoreItemFulfillment` (one per digital line: step SifPending, SifInvoiced, SifPaid,
    SifCompleted, SifHeld, SifRevoked; the invoice, payment, each step's marker, tries, next try, failure) and
    `StoreDownloadGrant` (a line's file, a PcntDownload ProductContent, its version text, recipient, store, site, dates,
    revocation and reason SdrRefunded/SdrReturned/SdrChargeback/SdrStaff, use count) in `entity/ShopFulfillmentEntities.xml`;
    the delivery ledger `mantle.party.MessageDelivery` (unique event, recipient, channel and template key; source, address,
    transactional flag, consent snapshot, state MdsQueued/Sent/Retry/Failed/Suppressed/Uncertain, attempts, next attempt,
    provider id) and `MessageDeliveryAttempt` in `entity/MessageDeliveryEntities.xml`; `data/ShopFulfillmentSetupData.xml`
    (PsetDownloadReady, the source MdsrcShopDownloads with its build service, MESSAGE_DELIVERY_REVIEW with its ADMIN grant,
    the jobs `fulfill_StoreItems` every five minutes and `run_MessageDeliveries` every two); `data/AccountHubSetupData.xml`
    (purpose PcpCartReminder, list type CART_REMINDER, setting PsstCartReminderList).
  - `mantle.product.ShopFulfillmentServices` (D, ShopFulfillment.js): `fulfill#ShopOrder` (SECA ShopOrderApprovedFulfillDigital,
    tx-commit on the approval, only for an order with a completed StoreCheckout): rows for the plain digital lines (PtDigital,
    no subscription resource), then capture (capture#SinglePayment with `shop-capture-{paymentId}` in a transaction holding only
    the payment, before any invoice), invoice (`create#FulfillmentInvoice`), finalize (its InvoiceFinalized email is the
    receipt) and check paid, `checkComplete#OrderPart` and the grants, then the download-ready notice on the ledger; each step
    in its own transaction, a failure counted with backoff, a declined capture holding the rows (SifHeld, no grant);
    `fulfill#StoreItems` (the job); `build#DownloadNotice` (the ledger's source: a guest's link with a new SalesOrder capability,
    OrderView and Download, its token only in the message; suppressed once nothing is left); `get#Downloads`, `issue#Download`
    (ten minutes, one grant's order, rate limited), `get#DownloadFile` (the capability and grant checked again, the use counted,
    the location kept on the server, the byte range); `reconcile#RefundedItem` (a settled return's digital lines, a named or
    cancelled line, or every digital line of an order whose payment less its refunds no longer covers them) with the SECAs
    `PaymentRefundedReconcileAccess` (refund#OrderPayment) and `ReturnSettledReconcileAccess` (settle#Return);
    `check#ApprovedEmail` (OrderApprovedSendEmail skips an all-digital Shop order). F22: `create#InvoiceFromSource` split
    (Payables.js `sourceOf`, `invoiceSource`) with the internal `mantle.account.InvoiceServices.create#FulfillmentInvoice`
    (no user permission; a sale only; `orderItemSeqIds` with their adjustments, each set of lines once by its source key).
  - The delivery ledger (X8, CX-DELIVERY, Comms' contract): `mantle.party.MessageServices` (MessageDeliveries.js)
    `queue#Delivery` (one per event, recipient, channel and template; kept in a transaction of its own; `sendNow`),
    `attempt#Delivery` (the source builds the message, consent snapshotted, send#EmailTemplate, the outcome: sent, retryable
    with backoff to five tries, permanent, else uncertain), `record#DeliveryReceipt`, `run#Deliveries` (never an uncertain one),
    `resolve#Delivery` (MESSAGE_DELIVERY_REVIEW).
  - `mantle.party.ShopCustomerServices` (A, ShopCustomer.js): `get#Account`, `find#Orders`, `get#Order`, `get#OrderDocument`,
    `preview#Reorder`, `reorder#Order`, `get#Addresses`, `store#Address`, `end#Address`, `get#PaymentMethods`,
    `begin#`/`finish#PaymentMethodSetup`, `end#PaymentMethod`, `get#AccountCard`; ownership by the self relationship or the
    SalesOrder OrderView link, never a party id. One account: a verified account claims the store's completed guest checkouts
    of its verified email whose guest party has no account (`merge#Parties` of the guest party, each in its own transaction).
    The test gateway's hosted checkout also keeps a card (`store#HostedPaymentProfile`) and sets one up
    (`begin#`/`finish#HostedMethodSetup`, a test card ending 1111); Authorize.Net's hosted profile page
    (`get#HostedProfileForm`, `sync#CustomerProfile` by the kept reference or the party as merchantCustomerId; F40);
    StoreCheckout.js `gatewayCapabilities` names them. Ending a card names the recurring orders it pays and needs confirming;
    Mantle ends it once its open payments complete (`ending`).
  - Support from Shop (F26, F27, F35; the owner contract, written into design-customer-service §8): SupportPortal.js `askers`
    admits a SalesOrder OrderView link (`orderToken`) as the order's customer for that one order in `get#CaseIntake`,
    `create#CustomerCase`, `get#ReturnableOrder`, `request#CustomerReturn` and `request#CustomerCancel`; a case about an order
    carries its store (`Request.productStoreId`, impl-commerce F37) and goes to the store's checkout support queue when the mount
    offers it; a guest's case has no filer. `get#CaseIntake` and `get#ReturnableOrder` are POSTs now (capability reads, F75).
    The Support pages take the link from the session (Support.js `orderLink`) and keep a guest's receipt on the page.
  - The PASS Account hub and email preferences (F6): `mantle.public.AccountHubServices` (AccountHub.js) `get#AccountHub` (a
    card per mounted app that registers PublicApps `accountCard`: Shop's, Billing's `PortalServices.get#AccountCard`, Support's
    `SupportCaseServices.get#AccountCard`, each in its own transaction), `get#`/`store#EmailPreferences` (a list link's token
    through resolve#/apply#UnsubscribePreferences, the account's lists, each site store's cart reminders by
    `store#PartyConsent` PcpCartReminder on the store's topic list), `apply#OneClickUnsubscribe`, and
    `check#CartReminderConsent` for Commerce P10 (never a party with no account). ConsentServices `create#UnsubscribeToken`
    links the recipient's site's `/account/EmailPreferences?token=` (a `siteId`, else a site the party belongs to that mounts
    Account; with neither, or a `baseUrl`, `/u/` as before). Billing: the Invoice kind admits the self relationship, and
    `find#Invoices` lists the account's own invoices beside its contacts' (R-SHP-W06).
  - Other Mantle: F76 (`check#AvailableInventory`: a PtDigital product passes the store's inventory requirement);
    OrderApprovedSendEmail skips an all-digital Shop order; merge#Parties moves StoreDownloadGrant, StoreItemFulfillment and
    StoreCheckout with their party; `check#OrderPreApprove` no longer fails on a part with no address when the store turns the
    address check off; a Shop placement gives the buyer the checkout's email as EmailBilling (the receipt's address);
    ExternalAccess's SalesOrder links find the order's store's Shop site (F82); the confirmation's link of an order with a file
    carries the Download scope; PassAuthority's DOWNLOADS takes `getShopDownload` with its size and range, and PassApi streams
    it ranged (206, 416).
  - PASS operations (Schema/Routes and the mirrors identical, `Contracts.d.ts`): `getShopAccount`, `findShopOrders`,
    `getShopOrder`, `getShopOrderDocument`, `previewReorder`, `reorder`, `getAddresses`, `storeAddress`, `endAddress`,
    `getPaymentMethods`, `beginPaymentMethodSetup`, `finishPaymentMethodSetup`, `endPaymentMethod`, `getDownloads`,
    `issueDownload`, `getShopDownload` (a GET file), `getAccountHub`, `getEmailPreferences`, `storeEmailPreferences`,
    `applyOneClickUnsubscribe`; Support's operations take `orderToken`; the reads that carry a link are POSTs, in the three
    TOKEN_WRITES lists with the Support ones an order link admits.
  - mr-pass pages: `screen/Shop/ShopAccount.js` with `Shop/Account.xml` (AccountOverview), `Shop/Orders.xml` (OrderList,
    OrderDetail routed from `Orders/{orderId}` by resolve#Route, Status for an emailed link, Document, reorder), `Downloads.xml`
    (file: a new capability then `Facade.downloadRanged` with the browser's range), `Addresses.xml`, `PaymentMethods.xml`
    (add, return, end) and `MethodRelay.xml` (Headers.js: its CSP alone, with PaymentRelay's, adds Authorize.Net's form-action);
    each through the active release's checkout page kind or the PASS shell; `Account/Home.xml` and `Account/EmailPreferences.xml`
    (Account/Hub.js); the header's My account and Your purchases links; the Support pages' guest order link; the minimal
    confirmation (F85).
  - BOSS: design-customer-service §8 records the owner contract; no new grant (MESSAGE_DELIVERY_REVIEW waits for a
    store-scoped review view, F-SP6-6).
  - Specs: Mantle `test/product/StoreFulfillment` (4 features, 2.6 s alone, 3.1 s in the full run: captured, invoiced, receipted and granted once with the
    notice and no approved email, the notice's link and the session's link downloading only that file with a range, an
    OrderView-only link refused; a declined capture granting nothing and holding the order, a run stopped between the
    invoice and the grant resumed by the job with no second invoice; a refund and a return ending their grants and a cached
    download capability, another order's grant kept; F76's physical default), `test/party/ShopCustomer` (4 features, 1.2 s (1.5 s in the full run): own
    orders by the link and the verified account, another refused alike, unverified none, the claim and the Billing invoice;
    reorder at today's price, addresses owned and at their revision; the hosted card setup once and the card's recurring order
    named; the store's cart reminders, a guest never, a list link to the site's page), `test/party/DeliveryLedger` (3 features,
    0.1 s), `test/request/SupportPortal` +1 (a case, return and cancel request by the order link, another order refused, no link
    no order; 0.5 s), ShopCheckout +1 (7 features), AuthorizeNetGateway +2 (19: the used reference and second approval; the hosted profile
    page's token and its sync keeping each new card once). mr-pass `test/Shop/ShopAccount` (3 features,
    0.4 s: an order link's one order locally and remotely, the Status page keeping it, the order page's one render with its
    Support and download links and no token, a remote download's range; the hub's one render with the Shop and Billing cards and
    the email preferences' cart reminders; the POSTs, the three lists and the relays' CSP); ShopCheckout (P5) reads the
    confirmation by the session. Also run, all pass: Mantle AccountingPortals, Consent, ShopCart, PaymentAttemptPurpose,
    OrderToCashBasicFlow, ReturnToResponseBasicFlow, Subscriptions, PassAuthority, AccountingPayables, AccountingMatching,
    AccountingBudgets, StoreCheckout, StoreAdmin, SitePages, Contacts, PartyServices, ContactBooks, PaymentGateway,
    GatewayContracts, AccountingPaymentGateway, ShopCatalog, OrderChanges, RestApiTests, AssetReservationMultipleThreads
    (259 features); mr-pass ShopCheckout, ShopCart, ShopAccess, Forum, SupportAccess, Portals, Transport.
    `./moq test-apps`: the server suites 3222 of 3222 passed (mr-mantle 387.6 s of 370, mr-boss 289.2 of 264, mr-pass 19.6 of
    17, each over and under 1.5 times; the run shared the machine with other spec runs, and mr-boss, which this phase barely
    touched, rose 37 s on the same code, so the shares are noisy: P6's own Mantle specs add about 6 s, mr-pass's 0.5 s);
    the client suites 17 of 17 passed (mr-pass 8.4 s of 6, as P5's F84; P6 adds no client spec).
  - Acceptance: `acceptance/ShopOrderScenarios` (4 features, on ZIZI_SHOP: the mixed purchase approved, its digital line
    captured, invoiced, receipted and downloaded by the notice's link only, the physical part shipped on its own invoice; a
    return request and a question by the order link and a cancel request of another order; the registered guest verified sees
    the order, the invoice and the case from the hub, unverified nothing; a buyer's hosted card setup and address, the card's
    recurring order named, a refund ending the download). `./moq accept mr-pass` once: server suite 24 passed, 3 ignored, 0
    failed; client suite 41 passed (ShopPaymentScenarios now reads its confirmation by the session, F85).
  - Lint: `moqui lint --screens` 132 sites as before, none in the Shop, Account or Support files.
  - Docs: mr-pass Deployment.md "Orders, account and downloads"; design-shop §4.2, §8.3, §9 (the checkout return), §10.
  - Decisions: capture before the invoice (no provider asked while the invoice or order is held), a mixed order's hosted
    authorization captured whole at the digital step and the physical invoice applying the rest; a verified account claims
    the guest purchases of its email by merge#Parties (the account's verification is the proof); the session's order link of
    an order with a file carries Download; a second approval under one reference holds the placed order as a mismatch does;
    the ledger is CX-DELIVERY's `MessageDelivery` with `MessageServices` (crosscut's names) and a source's build service makes
    a link's token fresh per attempt (no secret stored); the cart reminders topic is a contact list per store named by a store
    setting; Billing's Invoice kind admits the self relationship; the test gateway's hosted gateways keep and set up a test card.
  - Findings (provisional):
    - **F-SP6-1** Mantle's `check#OrderPreApprove` holds a new customer's order and a part with no address for staff, so a
      Shop guest's first order (digital too) waits for approval unless the store turns those checks off (`PsstOrdApproveNewCust`,
      `PsstOrdApproveAddrMissing`); design-shop §8.3 says an all-digital order's approval follows its payment. For Commerce (a
      store default for digital-only orders) or Sales.
    - **F-SP6-2** `refund#OrderPayment` refunds only an unapplied amount, so a fulfilled digital line's refund comes through a
      return's settlement (ReturnSettledReconcileAccess) or Accounting's chargeback intake (§7); PaymentRefundedReconcileAccess
      covers an unapplied payment's refund.
    - **F-SP6-3** The framework's resource stream reads whole (`readAllBytes` only), so a ranged download reads the file to cut
      the range, locally and in PassApi; over gRPC the host's `passAuthority.download` streams the whole file without the
      range. Framework: a partial read and a ranged gRPC download.
    - **F-SP6-4** A mixed order's money for its physical part is taken at the digital step (one capture of a hosted
      authorization), not at shipment; design-shop §8.2's separate payments per policy group need two provider pages, or a
      provider's partial capture. For the lead.
    - **F-SP6-5** `send#InvoiceStoreEmail` sends to EmailBilling only; Shop now gives the buyer the checkout's email as
      EmailBilling at placement, so its invoices' receipts reach the buyer.
    - **F-SP6-6** `resolve#Delivery` has no store scope, so BOSS grants MESSAGE_DELIVERY_REVIEW to no Commerce group yet; with
      Commerce P8's exceptions (or Comms), a store-scoped review.
    - **F-SP6-7** `getShopDownload` is a GET (the transports' downloads), so its ten-minute capability for one order is in the
      frontend's request to the authority, not in any browser URL.
    - **F-SP6-8** A guest's case or return filed by the order link reads nothing until the guest signs in verified (the claim
      then makes it the account's); the receipt stays on the page.
    - **F-SP6-9** design-shop §9's reorder of subscription lines and the PaymentMethods' replacement before switching are P7's
      (no recurring contract yet; ending a card names recurring orders only).

### P7 — Prepaid and recurring access

Design-shop §10 Subscriptions and SubscriptionDetail, §10.1–§10.2; SHOP-SUBSCRIPTION. Ends stage C3/S3 with Commerce
P12; gated on the adapter's off-session charges (design-shop §8.1).

- **RecurringTemplate** (X5; Sales' contract, F21): `OrderHeader.orderPurposeEnumId` with its RecurringTemplate value;
  credit exposure, the reservation and approved-email rules, subscription fulfillment and the Commerce, Warehouse and
  Insights order queries leave a base out, behind its crosscut §1.3 condition; `create#RecurringOrders` hands
  Shop-linked bases to Shop's coordinator and keeps every other base as today.
- **The records** (`mantle.product.subscription`): `StoreRecurringOffer`, `StoreRecurringContract` (with the
  off-session consent's time, method, terms version and evidence, and the resource instance) and
  `StoreRenewalOccurrence` (unique by contract and period).
- **`mantle.product.ShopSubscriptionServices`** (R): `get#Subscriptions`, `get#Subscription`,
  `begin#SubscriptionPurchase`, `change#SubscriptionMethod`, `cancel#Subscription` and `resume#Renewal`; the occurrence
  coordinator, which claims a period, clones the base with `copyPayment=false`, charges through the coordinator's
  shopRenewal purpose only with recorded consent, then places; retries at one, three and seven days within the store's
  policy; the notices `PsetPaymentRetry` and `PsetSubscriptionRenewal` through the ledger; Dunning's preview skipping the
  invoice of a renewal in retry (Accounting's contract).
- **Fulfillment** (F20): `OrderApprovedFulfillSubscriptions` conditioned for Shop items, preparation and settlement
  apart from activation, activation once by its marker with the contract's resource instance; `reconcile#RefundedItem`'s
  paid-access half, on P6's SECAs.
- **Merges** (F23): StoreRecurringContract follows `merge#Parties` by rule, its off-session consent never moved to
  another party on email alone.
- **Demo:** BOSS_COM_DIGITAL's paid-access product with its `ProductSubscriptionResource` rows for the Forum's paid
  category of ZIZI_DIGITAL as demo data, and a monthly offer saved through `store#RecurringOffer`, since Commerce P12's
  editors come after.
- **The adapter** (F14): stored-credential, merchant-initiated indicators on Authorize.Net profile charges.
- **`store#RecurringOffer`** (`COMMERCE_STORE_EDIT`; Commerce P12 builds its RecurringPolicy screen): an offer
  accepted only when the store's gateway has the off-session capability.
- **The subscription address** (§4): `store#RecurringOffer` sets
  `PublicSite.subscriptionUrl` to Shop's Subscriptions when the store has a current offer for the site, and clears it
  when none remains, never replacing an outside address a site owner entered; readiness reports a mismatch.
- **Operations:** `getSubscriptions`, `getSubscription`, `beginSubscriptionPurchase`, `changeSubscriptionMethod`,
  `cancelSubscription` and `resumeRenewal`.
- **Pages:** Subscriptions, SubscriptionDetail (Subscription, RenewPrepaid, RenewalHistory, ChangeMethod,
  CancelRenewal, ResolveRenewal); Checkout's recurring consent.
- **Specs:** Mantle `test/product/ShopSubscriptions` (one occurrence and order per period under two concurrent jobs, no
  charge without consent, no extension on a failed payment, cancellation keeping the paid term, a refund revoking only
  its source, a base never reserving, invoicing or emailing, other bases unchanged) and
  `test/account/DunningRenewalExclusion`; mr-pass `ShopSubscriptions`.
- **Usable when** (design-shop §18.1 "Prepaid/recurring purchase", "Renewal race/failure/cancellation", "Multiple access
  sources"): a verified buyer subscribes to the Forum's paid category of ZIZI_DIGITAL, and its "Manage your
  subscription" link opens Shop; the renewal charges once under a retried job; a declined renewal sends one notice and
  no Dunning letter; cancelling keeps access to the paid term; refunding the term leaves a manual grant.

### P8 — Adoption and operations

Design-shop §17.1 and §17.2's S4; SHOP-RENDER's remote caches and the S4 gate. Ends stage C4/S4 with Commerce P14.

- **Adoption preview:** a legacy store's categories, settings, content, slugs, gateways, facilities and email templates
  reviewed; publication rows proposed by Commerce P3's `propose#StorePublication` for a publisher to approve; template
  roles and wiki template spaces (POPC_DEFAULT's ZZWR_TMP) mapped to package sections with conversion findings; nothing
  enabled by the preview.
- **Operations:** open carts expired through the order path once no attempt is unresolved; Commerce's alert templates
  on checkout failures and long-unresolved attempts; the jobs' `operation` marks in the framework Monitor; withdrawal
  and rollback leaving placed orders and payments, with pending attempts reconciled.
- **Remote:** generation-checked caches on frontends; an authority outage serves no personal or unverifiable page.
- **Specs:** Mantle `test/product/StoreAdoption` (findings for unsupported syntax and unmapped settings; the proposed
  rows are Commerce P3's spec).
- **Usable when** (design-shop §18.1 "Rollback and withdrawal", "Partial failures"): adopting POPC_DEFAULT's categories
  proposes publication rows a publisher approves; withdrawing the mount leaves orders intact and an open attempt is
  reconciled; a remote frontend refuses cached personal pages while the authority is down.

### P9 — Finish

- The design-shop §18.1 review, each scenario with its spec or walk (§8), and the accessibility and device checks:
  keyboard checkout, labelled errors and focus, announced totals, reduced motion, no overflow at 390 px, discovery with
  JavaScript disabled.
- `docs/Deployment.md`'s Shop section (hosts and the root mount, provider configuration and CSP, scanner, caches, the
  reconciliation jobs), the README's Shop lines and development checks.
- The USL inventory's `PASS:` rows, design-shop's status, and Remaining-Work.

## 4. Decisions

These are made before and during the build. Each one that changes the design is also written into design-shop.md or
the owner's design. Shop's shared decisions are in impl-commerce §4 (the order, operation identities, the store
records, the deferred Marketing, Admin and Insights parts).

| Date | Decision | Notes |
| --- | --- | --- |
| Nov 5, 2026 | One root app per site, Forum or Shop; Shop's root is optional, its default mount `/shop`; its target is a ProductStore set by an operator | F2; design-shop §1 as written, the rule's place named |
| Nov 5, 2026 | On a Shop site, Shop's pages render the active theme's layout; Account, Billing and Support pages keep the PASS shell with the site's brand values from `PublicSite.theme` | F7; design-shop §1 changed. A themed Account is later (§7) |
| Nov 5, 2026 | The authority's error envelope carries an allow-listed camelCase reason and field errors to a remote frontend | F4; design-shop §7.3's reasons need it |
| Nov 5, 2026 | Shop's order page asks to cancel through Support's OrderCancelRequest (`requestOrderCancel`, `OrderChangeServices.request#CustomerCancel`); Shop has no cancellation operation or service of its own | F26; design-shop §9 and §13.2 changed (no pass-through) |
| Nov 5, 2026 | Customer Service's customer services admit the `SalesOrder` OrderView capability for its one order, as they admit a contact or the self relationship (P6) | F27; owner contract, written into design-customer-service §8 |
| Nov 5, 2026 | The payment-hold release permission is `PAYMENT_HOLD_RELEASE`, held by Accounting's treasury group | F15; X4 named no permission |
| Nov 5, 2026 | Digital fulfillment invoices through an internal Mantle service split from `create#InvoiceFromSource`, under fulfillment's own check, as Customer Service P10 split the package reopen | F22; design-shop §8.3 changed |
| Nov 5, 2026 | The delivery ledger is built in P6 as Comms' contract; the existing store emails (placed, approved, shipped, delivered, invoice finalized) keep `send#OrderStoreEmail` and their senders, and join the ledger when Comms moves them | F24, impl-commerce §4; design-shop §8.3's ledger delivery of those emails is later (§7) |
| Nov 5, 2026 | The PASS Account hub and email preferences page are built in P6 as the PASS Account foundation's, unless Customer Service P15 built them | F6 |
| Nov 5, 2026 | No marketing opt-in at checkout until Marketing builds `request#Subscription` | The user's call (impl-commerce §4, answer 5); design-shop §6 changed |
| Nov 5, 2026 | The payment page is Authorize.Net Accept Hosted, a redirect as Billing's; PASS's CSP stays as it is | The user's call (impl-commerce §4, answer 2); design-shop §8.1 changed. AcceptUI is later (§7) |
| Nov 5, 2026 | The store privacy provider waits for Admin's PrivacyServices (§7); the Shop records keep what it will need (owner, source order, dates) | F28 of impl-commerce |
| Nov 5, 2026 | Shop's order pages link the site's own Support pages for returns, questions and cancel requests rather than mounting them; a Shop site needs a Support mount targeting the store's organization; the `SalesOrder` OrderView capability admits a guest to them (P6) | The user's call in the review of Nov 5 (impl-commerce §4); F35. Design-shop §1, §2 and §9 changed |
| Nov 5, 2026 | Cart recovery needs the store's "cart reminders" topic, turned on by a signed-in customer on EmailPreferences (P6); guests never get recovery | The user's call in the review of Nov 5 (impl-commerce §4); design-shop §9 changed |
| Nov 5, 2026 | Reviews take scanned images (impl-commerce P9) | The user's call in the review of Nov 5; design-shop §5 changed |
| Nov 5, 2026 | `PublicSite.subscriptionUrl` is kept by `store#RecurringOffer` (P7), never over an outside address; readiness only checks it | The plan's choice (impl-commerce §4); design-shop §4.3, §10, §13.2 and §15 changed |
| Nov 5, 2026 | A refund revokes a download from P6; P7 adds paid access | The plan's choice, so S2's gate holds |
| Nov 5, 2026 | The payment relay route's CSP allows `form-action` to the Authorize.Net hosted page (production and sandbox); the rest of PASS keeps its CSP | The user's call during the build (F37), refining "PASS's CSP stays as it is"; P5 |

## 5. Open questions

The questions Shop shared with Commerce (the owners' contracts, the payment page, gift cards and click and collect, the
regression budgets, the checkout opt-in) were answered on Nov 5 and are in impl-commerce §4; further ones go in
impl-commerce §5.

## 6. Findings

Design assumptions found wrong or unstated in the code, with the resolution. Where a resolution changes the design, it
is written there too. F1–F34 were found on Nov 5, 2026, while writing this plan; F35–F36 later on Nov 5, from Customer
Service's finished code and the plan's review, which also updated F1, F6, F9, F16, F23 and F27.

| # | Finding | Resolution |
| --- | --- | --- |
| F1 | P0: an app registers in more places than `docs/Deployment.md`'s "Adding an app" (:221-228) lists: `service/pass/Apps.js`, Mantle's `PublicApps.js` (target and readiness), `screen/Pass.xml`'s subscreens, the Header's hardcoded branches (`Shared/Header.html.fancy`:4-10, billing, supplier and support), `Schema.js` and `Routes.js` with Mantle's `forum/ForumSchema.js` and `script/PassRoutes.js` (kept identical by Forum.spec and SupplierPages.spec), three `TOKEN_WRITES` lists (`Transport.js`:25, Mantle's `PassApi.js`:6 and `PassAuthority.js`:9; the doc names `Facade.js`), `test/MoquiConf.xml`'s mounts and Portals.spec's assertion that the targeted apps are billing and supplier | P1 registers in each and corrects the doc |
| F2 | P0: only Forum may mount at `/`, a rule in Mantle's `storeMounts` (Forum.js:2153-2154, `root:true` on forum alone in PublicApps.js); the framework does not restrict it. Mantle's reserved mount paths (Forum.js:2094-2119) lack `static`, `assets`, `sw.js`, `manifest.webmanifest` and `WebPush`, which `public_site.rs` reserves | P1 (§4) |
| F3 | P0: Pass.xml:7 sends `Cache-Control: no-store` and a CSP with `script-src 'self' 'unsafe-eval'` and `frame-ancestors 'none'` on every page | P1 makes the headers per route, P3 opens public caching for anonymous catalog routes; the preview has its own origin (impl-commerce P5) |
| F4 | P0: the authority's error envelope (Mantle `script/PassAuthority.js` `envelope`) answers a fixed message per status and empty field errors, so a remote page cannot tell why it was refused (impl-purchasing F170) | P1 (§4) |
| F5 | P0: operation results are kept three ways: the Forum's `ForumOperationReceipt` by site, actor party, operation ID and action (an 8–64 character ID); Billing's on `PostingOperation` through `EntityLib.operation` (8–40 characters); the Supplier app's submission records. A guest cart has no party | Shop's writes use `PostingOperation` with a scope of site and cart capability or party (impl-commerce §4) |
| F6 | P0: PASS has no Account hub; `Account/Unsubscribe`, titled "Email preferences", handles the Forum opt-out by token; list unsubscribe `/u/<token>` is a BOSS token route (mr-boss MoquiConf.xml:17-18 to `screen/Unsubscribe.xml`) whose URL ConsentServices builds (:1224), so a PASS-only deployment has no list unsubscribe page. Customer Service P15 built no hub: it added a Support card (My cases, My returns) to `Account/Settings` (:46-49) for a site that mounts Support | P6 (§4) |
| F7 | P0: `PublicSite.theme` exists and nothing reads it; `getSiteInfo` returns neither it nor `subscriptionUrl`; the PASS shell's style is a fixed `<style>` in Header.html.fancy | P1 (§4) |
| F8 | P0: `storeMounts` keeps targeted mounts on a site owner's save, deletes untargeted ones it is not given, and lets only an operator set a target | None: Shop is targeted, so a site owner's SiteDetail save keeps its mount |
| F9 | P0: media staging is the Forum's (Forum.js:2437-2528) and Accounting's `Portal.js` `stage` (PDF, PNG or JPEG, 10 MiB, scanned), shared with the Supplier app | Customer Service P15 made the shared module `mantle.party.PortalMedia.js` (its F58; PDF, PNG or JPEG, 10 MB, scanned), which Billing, Support and returns use; the Forum's stays its own. Review images (impl-commerce P9, §4) use it, PNG and JPEG only |
| F10 | P0: the locked renderer (`crates/moqui-core/src/script/template.rs`) runs a frozen sandbox that sees only its data with `format` and `localize`, with a 5 s deadline, 32 MiB of memory and a cache of 4096 compiled templates; it has no output, loop or include-depth limit, no `.fancy-locked` file exists under `runtime/`, and PASS's pages are trusted `.html.fancy` | P2's adapter adds the budgets beside the deadline and memory; design-shop §12.1, §12.4 and §14.3 changed |
| F11 | P0: `PublicSitePage` is keyed by site and page role (wiki page, version, publication revision); `get#SitePage` serves the roles guidelines and about only; `publish#SitePage` needs the site owner or an operator, the wiki's `canUpdate`, the page's published version and the expected revision, and advances the site's generation | impl-commerce P4: a `sitePageId` key with the role unique when set, and the mount, route, locale, window and SEO fields; design-shop §14.1–§14.2 changed |
| F12 | P0: site writes check the site's owner or an operator (`isOperator` is `isInGroup('ADMIN')`, ForumCore.js:63-85) | Commerce's and Shop's Mantle services check `COMMERCE_*` permissions and the store; the Forum's rule stays for its own pages and settings |
| F13 | P0: `PortalPaymentAttempt` (`mantle.account.payment`) has no purpose; its only source is an invoice and its only user is Portal.js; `begin#PaymentGatewayOperation` replays an `operationKey` and refuses a conflicting one or an unknown or pending outcome; the `resolve_PortalPayments` and `poll_PaymentGatewayDetails` jobs are paused | P5 (impl-commerce §4) |
| F14 | P0: the payments plan's Authorize.Net (P1) and PayTrace (P2) adapters, Shippo (S1) and X12 (E1) are built; Stripe (P3) and SPS (E2) are not. Authorize.Net takes Accept.js and AcceptUI opaque tokens and CIM profiles and receives webhooks as SystemMessages; Accept Hosted is documented and not built, and there are no stored-credential or merchant-initiated fields. Billing's hosted redirect is answered only by the test gateway. The plan's records still say nothing is committed | P5 adds Accept Hosted (impl-commerce §4), P7 the indicators; design-shop §8.1 changed |
| F15 | P0: the OrderHold types are Credit, Change, Purchase and Manual; there is no `OhtPayment` | P5 (§4) |
| F16 | P0: when first written, ExternalAccess's record kinds were Invoice, Order (purchase orders only), Quote, RequestCategory and Request, its app kinds billing and supplier, with no self relationship. Customer Service has since added the ReturnHeader and FormInvitation kinds, the `support` app kind and the self relationship `selfOf` (ExternalAccess.js:243-265); there is still no `SalesOrder` kind. `invite#Contact` refuses a person except for `support`, whose invitee must hold the Customer role; the token throttle (100 lookups per 10 minutes) and digest (`singleUseCodeHash`) are inside `tokenCapability` (:215-231), not exported | P4 exports the helpers for StoreCartAccess; P5 adds the `SalesOrder` kind |
| F17 | P0: `add#OrderProductQuantity` is anonymous and makes the order; `add#OrderPartPayment` defaults to Promised; `clone#Order` copies payments by default as Promised; `checkComplete#OrderPart` acts on Approved or Sent parts; `orderRevision` is audit-logged and counts only commercial changes for purchase parts, by PurchasePolicy | P4 binds the cart revision to Customer Service P10's sales flag (X2); P7 clones with `copyPayment=false` |
| F18 | P0: `get#ProductPrice` is anonymous-view; for an anonymous user it reads only rows with no vendor, customer or agreement (PriceResolver.js:71-72), a store makes its organization the vendor, and the trace is filled only for a price reader | P3 prices as the authority for the routed store and customer; design-shop §5.1 changed |
| F19 | P0: promotion use limits are counted over placed orders only, without a lock, and never at `place#Order` | impl-commerce P7's locked check, called at P5's freeze |
| F20 | P0: `fulfill#OrderPartSubscriptions` acts on PtDigital and PtDigitalAsset items, then invoices as Finalized, applies payments and completes the part, with no capture first; `fulfill#ProductSubscriptionResource` renews the latest subscription of the resource and subscriber (a resource-instance TODO, SubscriptionServices.xml:149); the handler interfaces take only a subscription ID; no SubscriptionResource row is in any data | P6 for plain digital items, P7 for paid access (design-shop §8.3, §10.2 as written) |
| F21 | P0: OrderHeader has no `orderPurposeEnumId`; a header with `recurCronExpression` is a recurring base; `create#RecurringOrder` clones it with payments copied (the default) and places it; the job runs nightly; `fulfill#OrderSubscriptions` skips a base | P7 (design-shop §10.1 as written) |
| F22 | P0: `create#InvoiceFromSource` (InvoiceServices.xml:4358, Payables.js:271) invoices an approved part on the ordered basis by `operationKey`, but needs `RECEIVABLE_EDIT` for a sales order and defaults to part 01 | P6 (§4) |
| F23 | P0: `merge#Parties` is Mantle's, with its guards there; it moves orders, invoices, payments, parties and consents, not ExternalAccessContact or ExternalAccessCapability | P4 adds StoreCartAccess to it, P6 StoreDownloadGrant, P7 StoreRecurringContract |
| F24 | P0: there is no Mantle delivery ledger; only the Forum's ForumDelivery and DeliveryWorker | P6 (§4) |
| F25 | P0: ConsentServices has `store#PartyConsent`, `get#PartyConsentState` and the unsubscribe token services (`create#`, `check#`, `resolve#UnsubscribeToken`, `apply#UnsubscribePreferences`) | P6's email preferences and impl-commerce P10 use them |
| F26 | P0: design-shop's `requestCancellation` operation and `A.request#Cancellation` duplicate Customer Service's `requestOrderCancel` and `OrderChangeServices.request#CustomerCancel` (design-customer-service §8 NewCustomerCase) | §4; design-shop §2, §9 and §13.2 changed |
| F27 | P0: Customer Service's customer services and Support pages admit a contact's customer relationship or the self relationship only (`actingFor`, CustomerOrders.js, SupportCases.js:86-91); a guest's `SalesOrder` OrderView capability, which design-shop §4.2 says admits return and help requests for its order, is not among them (Customer Service F210) | §4, P6's owner contract |
| F28 | P0: the Forum's product discussion link treats a PublicSiteApp of app `store` with the store as target as the site's store, and checks ProductStoreProduct (ForumIntegration.js:379-385) | P3 reads the `shop` mount and the publication resolver |
| F29 | P0: the gRPC transport sends an `operationId` that the authority's `handle#Call` does not pass on (Transport.js:303, PassAuthorityServices.xml:17-28) | Shop's writes carry their operation ID in `input`; P0 checks token writes with a cart capability on both transports |
| F30 | P0: Billing and Supplier pages are XML screens whose actions call `Shared/Portal.js` `attempt` and render `.html.fancy` with raw forms in `form-single` sections; the error kinds' texts are fixed in Portal.js | Shop's account and result pages follow it; themed pages render through the adapter (P2) |
| F31 | P0: mr-pass's regression budget is 15 s server and 6 s client | Raised per phase by its measured share, with the user's agreement (impl-commerce §4) |
| F32 | P0: Mantle's `MantleProduct` DataDocument is the product search index | P3 filters its hits by the resolver |
| F33 | P0: the demo PASS site ZIZI_PORTAL (host `portal.zizi.localhost`, Account, Billing and Supplier mounts) is made by Accounting's demo service; the test runtime's `<public-site>` is host 127.0.0.1 with six mounts | P1's demo site ZIZI_SHOP, made by Commerce's demo service; the test conf gains a Shop mount |
| F34 | P0: readiness per app is PublicApps' `readiness` service, run by the Forum's `checkReadiness` for each enabled mount (Billing and Supplier use Portal's `check#AppReadiness`) | P1 registers Commerce P2's `check#StoreReadiness` as Shop's |
| F35 | P0: the Support pages work only on a site with its own Support mount: their operations pass the resolved site, `served(siteId)` (SupportPortal.js:130-136) needs that site's enabled `support` mount with an internal target that has a ServicePolicy, `orderFor` (CustomerOrders.js:50-60) needs each order part's vendor to be the target, and the pages redirect to `passBases.support`; with no Support mount every operation answers NotFound. OrderCancelRequest is NewCustomerCase's `cancelOrder` transition for an `orderId`, its operation `requestOrderCancel` | §4: Shop links the site's Support pages with the order, and Commerce P6's readiness requires the mount; design-shop §1, §2 and §9 changed |
| F36 | P0: the sales commercial revision flag is `PartyAcctgPreference.salesCommercialRevisionOnly` (Y in the demo on ORG_ZIZI_CORP), but `increment#OrderRevision` counts every change of a part with no customer or vendor party (OrderServices.xml:2926; impl-commerce F40) | P4's cart part always carries a customer party |
| F37 | P0: Accept Hosted needs an HTML form POST of a 15-minute token to accept.authorize.net; PASS's `form-action 'self'` (Pass.xml:7) blocks it, also after a form submit's redirect, and Billing's `redirectUrl` is a GET link | P5: `redirectUrl` is a same-origin relay route that requests a fresh token on each visit and auto-POSTs it; only that route's CSP adds `form-action https://accept.authorize.net` (test.authorize.net for the sandbox); reached by a link, no-store, the token never stored. The user's call (§4): the CSP is adjusted as needed for this route |
| F38 | P0: the hosted page returns no result in redirect mode (the receipt always shows; Continue and Cancel are bare GETs), and the payer may never press Continue | P5: the return, the webhooks and the reconciliation job only trigger `get#PaymentGatewayDetails` by reference; the attempt's reference fits 20 characters, in `refId` and `order.invoiceNumber`; `merchantName` set |
| F39 | P0: `consumeWebhook` matches only resultUnknown responses by `merchantReferenceId` (AuthorizeNet.js:702-747), which may be absent; a pending hosted attempt has no paymentRefNum | P5: pending hosted attempts matched by reference, else by the invoiceNumber from `getTransactionDetails(payload.id)` |
| F40 | P0: neither the hosted payment page nor the hosted profile page hands back the new customer or payment profile ID; the adapter's `storeProfile` takes only opaque tokens (:552-629) | P5: after an approved hosted transaction the profile is read from the details, else `createCustomerProfileFromTransactionRequest` with billTo; P6: the hosted profile page syncs by `getCustomerProfileRequest` on return and on `customer.paymentProfile.*` webhooks |
| F41 | P0: no `networkTransId` is captured or stored, and there are no stored-credential or merchant-initiated inputs | P5 stores the first transaction's `networkTransId` and amount; P7 adds `processingOptions`, `subsequentAuthInformation` and `authorizationIndicatorType` in schema order (checked at :105), its `reason` casing checked in the sandbox |
| F42 | P0: every response to a cookieless visitor carries `Set-Cookie` and a `moquiSessionToken` header (screen/mod.rs:683-705), the PASS header embeds the session token (Header.html.fancy:2) and the qvt modes add `private, no-store`, so no public catalog page can be shared-cached; the routing sets no headers and a screen's own headers win | Framework (the framework worker, for P3): a `Cache-Control: public` response to a cookieless anonymous request sends no cookies or token and keeps no session or Visit. P3 in mr-pass: catalog pages render without the token or signed-in state (a fetched header fragment, forms fetching their token); Pass.xml sends public caching only for anonymous session-less catalog routes |
| F43 | P0: a remote frontend calls `getSiteInfo` (per user, uncacheable) on every page, the authority answers `no-store` (PassApi.js:133), and Transport.js has no cache | P2/P3: an anonymous `getSiteGeneration` read; catalog results carry their generation and release; Transport.js gets a bounded read-through cache for anonymous GETs keyed by site, operation, input, locale, currency, generation and release |
| F44 | P0: a cart's first write has no token, and `routeOf` refuses a non-GET with neither delegation nor token (Transport.js:133-139) | P4: cart creation is an anonymous write in all three `TOKEN_WRITES` lists, as `applyOptOut` is, throttled by `passRequester`; it returns the capability, kept in the presentation's server session and sent as `input.token` |
| F45 | P0: the Forum's Vue enhancement is an html.fancy page with a JSON config, a hidden root and WebrootPublic.qvt.js loading the screen's `.qvue`, under PASS's `'self' 'unsafe-eval'` CSP; it mounts one component per page in a full `q-layout`, embeds the session token, and cannot be emitted by a locked theme template | P4/P5: purchase selection, cart and checkout are one qvue per page over the plain forms, emitted by an adapter-made required-component fragment; framework (the framework worker): WebrootPublic.qvt.js gains an island mode |
| F46 | P1: refusals reached pages as "Error: Error: CODE: text"; Portal's code-stripping never matched | P1 (built): Transport and Portal strip the prefixes and map the reason |
| F47 | P1: the framework's route resolver passes only the Forum's three IDs, so Shop pages read their IDs from `publicPath` | Framework (mr-moqui 885a273d): a resolver service may return `screenParameters`, bound before the site and Forum IDs, which it cannot override |
| F48 | P1: the demo Shop mounts belong to Commerce's demo service in mr-boss, which a PASS worker may not edit | Done by the lead: mr-boss `Demo.js` makes ZIZI_SHOP's Shop mount at `/` for POPC_DEFAULT and ZIZI_DIGITAL's at `/shop` for BOSS_COM_DIGITAL; CommerceAccess, CommerceStores and CommerceFoundationWalk expect them |
| F49 | P1: `public_site.rs` `resolve_conf` decides a request is for a public site before checking the host, so a `/` mount on one host makes every non-framework path on every other host answer "Public hostname not found" | Framework (mr-moqui 885a273d): a root mount claims only its own host; a named mount on a host no site names is still concealed; framework paths stay reserved |
| F50 | Commerce P3 review: `get#StorePublication` without a `siteId` skips the site check, and "site access" does not yet read the site's own access rule | P3: Shop's catalog reads always pass the site; the resolver requires it from a non-staff caller and reads the site's access |
| F51 | Commerce P3 review: the resolver's public list mode resolves every published product before paging (one `check#ProductUsable` each) | P3: Shop's catalog uses the in-process `resolve` with its own paging and the index's candidates (F32) |
| F52 | P2: the adapter checks `locales/*.json`, but no template function reads it (`localize` is the renderer's own), so the starter's texts are literals | Optional framework work: a theme translation reader; Commerce P5's Translations edit the files meanwhile |
| F53 | P2: the framework keeps `/assets` at the root, so a root Shop cannot use it | Release assets are served at `{mount}/theme/{manifestDigest}/{path}`; design-shop changed |
| F54 | P2: variables set in a screen's `actions` don't reach the parent screen's widgets; only `always-actions` variables do | Shop.xml decides `shopThemed` in always-actions |
| F55 | P2: a theme package is text only, so binary assets (Commerce P5's uploads) need byte transport in the release reads and the asset route | Commerce P5 (with framework work if needed) |
| F56 | P2: after a switch only the active release's assets are served | Kept: a page of the old release reloads; noted in design-shop §12.7 |
| F57 | P2: `ec.resource.theme.engines()` reports no renderer version, so Mantle records version 1 | Optional framework work |
| F58 | P2: F43's Transport.js read-through cache is not built | P3 |
| F59 | P2: the inventories are mr-boss's; the CLIENT_READS rule is tested in ShopThemes (it needs a published release) | The lead updates the inventories at the finish |
| F60 | P3: a screen's output always opened with status 200 (`start_output`), so a status its actions set was lost (P2's 503 never reached the browser) | Framework (mr-moqui 56f9aa35): a status a screen's actions set before output is the response's, also with no body written, for xlsx and server-static `/actions`; a qvt render at a set 4xx or 5xx is `private, no-store`. Catalog.js's own writes of 404, 503 and redirects stay correct |
| F61 | P3: product images are `component://` or `dbresource://` locations, so P3 shows none | P4: a public image route behind the publication resolver |
| F62 | P3: the public list mode of `get#StorePublication` still resolves every row (F51); Shop no longer calls it | Commerce's to drop or bound later |
| F63 | P3: Pass.xml still calls `getSiteInfo` uncached on every remote page | P8 (remote caches) |
| F64 | P3: the authority price skips PriceResolver `extras` (feature extras on a virtual's price), and the low-stock threshold of 5 is fixed | P4: extras for the authority price; the threshold a store setting later |
| F65 | P3: hreflang names only the page's own locale, since Shop URLs carry no locale | Later (localized routes) |
| F66 | P3: existing databases keep ZZW_RETAIL's old URL and `/pcontact`; the data change reaches only new databases | Noted in mr-mantle docs/Upgrading.md at the finish |
| F67 | P3 review: ProductDetail's "Ask a question" Forum link is not built; `Knowledge.js` `publicLink` refuses NO_PUBLIC_URL before trying the Support site's article page; search sends the visitor's text to the index as a query string, whose syntax the visitor controls; a category whose members are published but none public shows "No products here yet" | P4: the Ask a question link, and search text escaped (a simple query) to bound its cost; `publicLink` tries the Support site first (Customer Service's owner contract, P6); the category case kept (only its name shows) |
| F68 | P4: TEST1 is limited to the customer CustJqp, so a guest cannot use it | The walks use TEST2 (Buy 1 Get 1 Half Off) |
| F69 | P4: a refused nested service call marks the transition's transaction rollback-only, so the refusal came back as a 500 | `Portal.attempt({newTransaction: true})` for the cart; Billing's and Support's page writes may need it (later) |
| F70 | P4: `ec.web.sendJsonResponse` answers only 200 or 500 and adds the request's messages | The cart writes its JSON with its own status |
| F71 | P4: sign-in lands on `/forum` by default even on a Shop site without a Forum mount | P6: the Account return goes to the site's root app |
| F72 | P4: an island's first request starts a session, so the visitor's later catalog pages are no-store | Optional framework work: serve a public `.qvue` without a session |
| F73 | P4: "Ask a question" is not built: Forum `publish#Post` takes no product to link by `CommunicationEventProduct`, and no setting names the site's product category | Later (the Forum's owner) |
| F74 | P4: no job retires expired open carts, guest parties or cancelled guest orders | P8 |
| F75 | P4 review: `store#Mounts` deletes and recreates every mount a save names, so re-saving a Shop mount with a theme binding fails on its foreign key and the mount's id changes; a remote `getCart` is a GET with the capability as a query parameter; product images are no-store and read any location scheme staff enter; Mantle's promo-code warnings stay in `ec.message` | `store#Mounts` keeps an existing mount's row (P5 follow-up); capability reads as POST (P5); images cached by generation and limited to `dbresource://`/`component://` (P8); pages never show raw request messages |
| F76 | P5: `check#AvailableInventory` checks stock even for digital products in a store that requires inventory, so POPC_DEFAULT cannot cart a digital item | P6: digital items (no physical stock) pass the store's inventory requirement, with a test of the physical default |
| F77 | P5: the test gateway's details lookup approves before the payer has visited the hosted page | The result page waits a second after authorizing; the return looks up at once |
| F78 | P5: a redirect from a screen's actions is lost once the PASS shell header is written | Checkout's redirects are in pre-actions |
| F79 | P5: the Commerce demo bound POPC_DEFAULT's card payments to TEST_APPROVE, which has no hosted page | Fixed in the review: `BOSS_COM_HOSTED` with Mantle test services that approve a payment with a method and send one without to the hosted page; Mantle's POPC_DEFAULT specs unchanged |
| F80 | P5: Billing with Accept Hosted would need its own relay | Accounting's (later) |
| F81 | P5: the checkout steps are plain forms; the Vue enhancement is not built, polling is a script | Design-shop updated; enhancement later |
| F82 | P5: the confirmation QR and the SalesOrder link point at P6's order pages | P6 |
| F83 | P5: no spec covers the address correction, the saved card or an amount mismatch | P6 adds the amount mismatch and saved card cases |
| F84 | P5: ShopCheckoutWalk's client time puts mr-pass's client budget over | Raised at the next quiet suite run by the measured share (the user's agreement) |
| F85 | P5 review: two hosted pages open at once (two tabs' relays) can each take a payment under one reference and the lookup finds one; the return URL's reference and key (known to the provider, kept in history) read the checkout for a day, issue the guest's order link to whoever reads the confirmation first, and after a decline hand over a new cart capability; a declined hosted payment shows pending for the 15-minute window; a placement refused ORDER_CHANGED or past its tries stays placementPending with an approved payment; an amount mismatch is placed and held (OhtPayment) | P6: refuse a new form token once the reference has a transaction and flag a reference with more than one approval; issue the order link only to the cart's session; drop the cart hand-over from the reference path. The held mismatch is design-shop §8.2's exception (accepted); the pending window is accepted; Commerce P8 lists stuck placements |

## 7. Later

Designed, not in this build:

- **The design's later scope** (design-shop §17.2, §20): Liquid compatibility, advanced B2B, POS and offline terminals,
  loyalty and cross-store programs, proration and usage billing, physical subscription boxes, wishlists and comparison, a
  theme marketplace, the Publishing app; social sign-in, back-in-stock notices, quote from cart (with Sales), semantic
  catalog search, shopper agents over MCP, recently viewed products, video help from an order.
- **Owners not built:** Marketing's tracking and visitor key, attribution at placement and the checkout opt-in; Admin's
  privacy request page and the store privacy provider; Sales' quote scopes of the `SalesOrder` kind and its Account hub
  card; Accounting's chargeback intake calling `reconcile#RefundedItem` (impl-accounting §7).
- **Delivery:** the existing store emails as sources on the delivery ledger, when Comms moves them.
- **Payments:** AcceptUI or another embedded provider form as an operator capability with its CSP (Accept Hosted was
  chosen for the first build); Stripe as the second adapter (the payments plan's P3).
- **Pages:** a themed PASS Account on a Shop site; a PASS terminal UI.

## 8. Verification

- **Per phase,** the "Done" rule of §2.
- **End to end,** open the demo Shop site ZIZI_SHOP as an anonymous visitor, a guest buyer and a signed-in buyer, and
  walk each built phase's "usable when", locally and through a remote frontend with only framework, webroot and PASS
  installed; then the staff side in Commerce (impl-commerce §8).
- **Design-shop §18.1 scenarios,** each an acceptance test (`./moq accept mr-pass`, when asked):

| Scenario | Phase |
| --- | --- |
| Two sites and stores, one shopper, local and remote | P1, P3, P4 (ZIZI_SHOP and ZIZI_DIGITAL) |
| Anonymous browse and explicit publication | P3; impl-commerce P3, P14 |
| Guest checkout and later account login | P4, P5, P6 |
| Price, stock, address and promotion changes | P5; impl-commerce P7 |
| Duplicate submit, crash and callbacks | P5, P6 |
| Unknown provider outcome | P5 |
| Mixed physical and digital purchase | P6 |
| Failed placement after provider success | P5 |
| Protected download | P6, with its refund revocation |
| Prepaid and recurring purchase; renewal race, failure and cancellation; multiple access sources | P7 |
| Account and payment self-service | P6 |
| Reviews and support | P6 (support); impl-commerce P8, P9 (reviews and their images) |
| One account | P6 |
| Payment exception after placement | P5; impl-commerce P8 |
| Theme visual and source edit; renderer attacks and limits; preview and publication | P2; impl-commerce P5 |
| Rollback and withdrawal; partial failures | P2, P3, P8 |
| Accessibility and devices | P3–P7; P9 |

- **Walks.** Shop's browser walks are acceptance tests in mr-pass at 390 px and on the desktop, locally and through a
  remote frontend; the regression suite has one golden-path walk for the app (P5's ShopCheckoutWalk). No screenshots.
