// Shop P1's "usable when" (impl-shop P1; design-shop §1, §4.1, §4.3): an operator mounts Shop at the root of ZIZI_SHOP for
// POPC_DEFAULT; /account, /billing and /support still reach their owners, and the framework's paths cannot be taken; the
// site's readiness lists the store's findings; published, the root shows the store; a remote frontend (the authority's
// answer as the transport takes it) gets the same context, and a refused write shows its reason there. ZIZI_SHOP is
// Commerce's demo site (mr-boss Demo.js); without BOSS the spec makes it as the demo does, so PASS stands alone. The site's
// state is put back after; its Shop mount stays, as the demo's. The spec stands in any order: a theme release bound to
// the Shop mount (ShopFixtures, ShopThemeRelease) is set aside for it, so the root shows the PASS shell and the mount can be
// saved again (store#Mounts recreates a named mount, which a binding would hold), and put back after.
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const SITE = 'ZIZI_SHOP',
    HOST = 'shop.zizi.localhost',
    STORE = 'POPC_DEFAULT',
    ORG = 'ORG_ZIZI_RETAIL'
let before
const BINDING = 'mantle.public.PublicThemeBinding'
const bindingFields = [
    'siteId',
    'appMountId',
    'themeId',
    'releaseId',
    'activation',
    'revision',
    'siteGeneration',
    'activatedDate',
    'activatedByUserId',
]
let bindings = []
/* The site's Shop mount id now, so a save keeps it (as the Sites page sends it). */
const shopMountId = () =>
    Array.from(
        ec.entity
            .find('mantle.public.PublicSiteApp')
            .condition({ siteId: SITE, app: 'shop' })
            .disableAuthz()
            .list(),
    )[0]?.appMountId
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        if (!l.siteRow(SITE)) {
            l.site(SITE, HOST, {
                name: 'Ziziwork Retail Store',
                registrationMode: 'open',
                approvalRequired: 'N',
                timeZone: 'America/Chicago',
            })
            for (const [app, targetId] of [
                ['account', null],
                ['billing', ORG],
                ['support', ORG],
            ])
                l.run('create#mantle.public.PublicSiteApp', {
                    siteId: SITE,
                    appMountId: app,
                    app,
                    pathPrefix: '/' + app,
                    enabled: 'Y',
                    targetId,
                })
        }
        before = l.siteRow(SITE).state
        bindings = Array.from(
            ec.entity
                .find(BINDING)
                .condition({ siteId: SITE })
                .disableAuthz()
                .list(),
        ).map((row) =>
            Object.fromEntries(bindingFields.map((f) => [f, row[f] ?? null])),
        )
        for (const row of bindings)
            l.run('delete#' + BINDING, {
                siteId: row.siteId,
                appMountId: row.appMountId,
            })
        setProperty(
            'pass_client_' + l.ids.client + '_secret',
            'pass-shop-mount-secret',
        )
        setProperty('pass_client_' + l.ids.client + '_sites', SITE)
    },
    cleanupSpec() {
        login('john.doe')
        const l = lib()
        l.setState(SITE, before)
        const mountId = shopMountId()
        for (const row of bindings)
            l.run('create#' + BINDING, {
                ...row,
                appMountId: mountId || row.appMountId,
            })
    },
})
feature(
    'an operator mounts Shop at the root of ZIZI_SHOP for POPC_DEFAULT, and the other apps keep their paths',
    {
        when() {
            const l = lib()
            const others = Array.from(
                ec.entity
                    .find('mantle.public.PublicSiteApp')
                    .condition({ siteId: SITE })
                    .disableAuthz()
                    .list(),
            ).filter(
                (m) =>
                    m.app !== 'shop' &&
                    m.app !== 'billing' &&
                    m.app !== 'support',
            )
            const core = others.map((m) => ({
                app: m.app,
                pathPrefix: m.pathPrefix,
            }))
            const reserved = ['/static', '/rest', '/s', '/u', '/assets'].map(
                (p) =>
                    l.mounts(SITE, [
                        ...core,
                        { app: 'shop', pathPrefix: p, targetId: STORE },
                    ]).kind,
            )
            const mountId = shopMountId()
            const saved = l.mounts(SITE, [
                ...core,
                {
                    app: 'shop',
                    pathPrefix: '/',
                    targetId: STORE,
                    ...(mountId ? { appMountId: mountId } : {}),
                },
            ])
            l.setState(SITE, 'published')
            const r = (path) => l.route(SITE, HOST, path)
            return {
                reserved,
                saved,
                routes: {
                    root: r('/'),
                    product: r('/products/DEMO_1_1/demo-product'),
                    account: r('/account/Login'),
                    billing: r('/billing/Invoices'),
                    support: r('/support/SupportHome'),
                },
                readiness: l.facade('checkReadiness', { siteId: SITE }).result,
            }
        },
        then({ reserved, saved, routes, readiness }) {
            reserved.every((k) => k === 'Unprocessable')
            saved.result.revision > 0
            routes.root === '/Shop/'
            routes.product === '/Shop/Products/ProductDetail'
            routes.account === '/Account/Login'
            routes.billing === '/Billing/Invoices'
            routes.support === '/Support/SupportHome'
            readiness.checks.filter((c) => c.name.startsWith('shop ')).length >
                0
        },
    },
)
feature(
    'the root shows the store to a visitor; a remote frontend gets the same context and sees a refusal’s reason',
    {
        when() {
            const l = lib()
            logout()
            const home = l.render(SITE, HOST, '/', 'Shop')
            const account = l.route(SITE, HOST, '/account/Login')
            login('john.doe')
            const local = l.facade('getShopContext', { siteId: SITE }).result
            const far = l.remote('getShopContext', { siteId: SITE }).result
            const input = {
                siteId: SITE,
                expectedRevision: Number(l.siteRow(SITE).policyRevision),
                mounts: [
                    { app: 'shop', pathPrefix: '/', targetId: STORE },
                    { app: 'shop', pathPrefix: '/shop', targetId: STORE },
                ],
            }
            return {
                home,
                account,
                local,
                far,
                localWrite: l.facade('storeMounts', input),
                remoteWrite: l.remote('storeMounts', input, {
                    sessionChecked: true,
                }),
            }
        },
        then({ home, account, local, far, localWrite, remoteWrite }) {
            home.errors.length === 0
            home.html.includes('Ziziwork Retail Store')
            home.html.includes('aria-label="Shop"')
            account === '/Account/Login'
            local.store.productStoreId === 'POPC_DEFAULT'
            local.mount.base === ''
            JSON.stringify(far) === JSON.stringify(local)
            localWrite.reason === 'mountTaken'
            remoteWrite.reason === 'mountTaken'
            remoteWrite.message === localWrite.message
        },
    },
)
