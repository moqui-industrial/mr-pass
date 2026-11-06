// Shop P3's catalog walks' data (impl-shop P3; ShopHttp, ShopRemoteHttp): the demo Shop sites as Commerce's demo makes them
// (mr-boss Demo.js; without BOSS the fixture makes them so PASS stands alone), published: ZIZI_SHOP on shop.zizi.localhost
// with Shop at its root for POPC_DEFAULT, the starter theme published and its returns policy page; ZIZI_DIGITAL on
// digital.zizi.localhost with Shop at /shop for BOSS_COM_DIGITAL, with no theme (the PASS shell). POPC_DEFAULT publishes
// the products Commerce's demo does (DEMO_1_1, DEMO_1_2, DEMO_2_1, DEMO_3_1, DEMO_UNIT; DEMO_VAR stays unpublished), and
// BOSS_COM_DIGITAL a digital field guide. Each record is made once.
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const T = 'mantle.public.ThemeServices.'
const sites = [
    {
        siteId: 'ZIZI_SHOP',
        name: 'Ziziwork Retail Store',
        hostname: 'shop.zizi.localhost',
        organizationPartyId: 'ORG_ZIZI_RETAIL',
        productStoreId: 'POPC_DEFAULT',
        shopPath: '/',
    },
    {
        siteId: 'ZIZI_DIGITAL',
        name: 'Ziziwork Digital Store',
        hostname: 'digital.zizi.localhost',
        organizationPartyId: 'ORG_ZIZI_SERVICES',
        productStoreId: 'BOSS_COM_DIGITAL',
        shopPath: '/shop',
    },
]
const published = ['DEMO_1_1', 'DEMO_1_2', 'DEMO_2_1', 'DEMO_3_1', 'DEMO_UNIT']
const one = (entity, fields) =>
    ec.entity.find(entity).condition(fields).disableAuthz().one()
spec({
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
    },
    cleanupSpec() {
        ec.artifactExecution.enableAuthz()
    },
})
feature(
    'provision the demo Shop sites, their published products, ZIZI_SHOP theme and returns page',
    {
        when() {
            const l = lib()
            const once = (entity, key, values) => {
                if (!one(entity, key))
                    l.run('create#' + entity, { ...key, ...(values || {}) })
            }
            once(
                'mantle.product.store.ProductStore',
                { productStoreId: 'BOSS_COM_DIGITAL' },
                {
                    storeName: 'Ziziwork Digital Store',
                    organizationPartyId: 'ORG_ZIZI_SERVICES',
                    defaultCurrencyUomId: 'USD',
                    defaultLocale: 'en_US',
                },
            )
            for (const site of sites) {
                once(
                    'mantle.public.PublicSite',
                    { siteId: site.siteId },
                    {
                        name: site.name,
                        state: 'disabled',
                        registrationMode: 'open',
                        approvalRequired: 'N',
                        locale: 'en',
                        timeZone: 'America/Chicago',
                        policyRevision: 1,
                        generation: 1,
                    },
                )
                once(
                    'mantle.public.PublicSiteHost',
                    { hostname: site.hostname },
                    { siteId: site.siteId, canonical: 'Y' },
                )
                for (const [app, targetId] of [
                    ['account', null],
                    ['billing', site.organizationPartyId],
                    ['support', site.organizationPartyId],
                ])
                    once(
                        'mantle.public.PublicSiteApp',
                        { siteId: site.siteId, appMountId: app },
                        { app, pathPrefix: '/' + app, enabled: 'Y', targetId },
                    )
                once(
                    'mantle.public.PublicSiteApp',
                    { siteId: site.siteId, appMountId: 'shop' },
                    {
                        app: 'shop',
                        pathPrefix: site.shopPath,
                        enabled: 'Y',
                        targetId: site.productStoreId,
                    },
                )
                l.setState(site.siteId, 'published')
            }
            const publish = (productStoreId, productId) => {
                const rows = Array.from(
                    ec.entity
                        .find('mantle.product.store.ProductStoreProduct')
                        .condition({ productStoreId, productId })
                        .disableAuthz()
                        .list(),
                )
                if (!rows.length)
                    l.run('create#mantle.product.store.ProductStoreProduct', {
                        productStoreId,
                        productId,
                        fromDate: 0,
                    })
            }
            for (const productId of published)
                publish('POPC_DEFAULT', productId)
            once(
                'mantle.product.Product',
                { productId: 'PASS_HTTP_GUIDE' },
                {
                    productName: 'Digital field guide',
                    productTypeEnumId: 'PtDigital',
                    ownerPartyId: 'ORG_ZIZI_SERVICES',
                },
            )
            once(
                'mantle.product.ProductPrice',
                { productPriceId: 'PASS_HTTP_GUIDE_C' },
                {
                    productId: 'PASS_HTTP_GUIDE',
                    pricePurposeEnumId: 'PppPurchase',
                    priceTypeEnumId: 'PptCurrent',
                    fromDate: 0,
                    minQuantity: 1,
                    price: '9.00',
                    priceUomId: 'USD',
                },
            )
            publish('BOSS_COM_DIGITAL', 'PASS_HTTP_GUIDE')
            // ZIZI_SHOP's returns policy page (Commerce's demo publishes one in the store's page space): a published wiki version
            // bound at pages/returns
            if (
                !one('mantle.public.PublicSitePage', {
                    siteId: 'ZIZI_SHOP',
                    routePath: 'returns',
                })
            ) {
                const wiki = (verb, parameters) =>
                    l.run('org.moqui.impl.WikiServices.' + verb, parameters)
                if (
                    !one('moqui.resource.wiki.WikiSpace', {
                        wikiSpaceId: 'PASSHPG',
                    })
                )
                    wiki('create#WikiSpace', {
                        wikiSpaceId: 'PASSHPG',
                        description: 'Shop acceptance pages',
                    })
                const wikiPageId = wiki('update#WikiPage', {
                    wikiSpaceId: 'PASSHPG',
                    pageName: 'Returns policy',
                    pageText:
                        'Return any item within 30 days of delivery for a full refund.\n',
                }).wikiPageId
                const versionName = wiki('get#WikiPageHistory', { wikiPageId })
                    .versionList[0].versionName
                wiki('set#PublishedVersion', {
                    wikiPageId,
                    publishedVersionName: versionName,
                })
                l.run('create#mantle.public.PublicSitePage', {
                    siteId: 'ZIZI_SHOP',
                    appMountId: 'shop',
                    routePath: 'returns',
                    pageRole: one('mantle.public.PublicSitePage', {
                        siteId: 'ZIZI_SHOP',
                        pageRole: 'returns',
                    })
                        ? null
                        : 'returns',
                    title: 'Returns policy',
                    wikiPageId,
                    versionName,
                    fromDate: 0,
                })
            }
            // ZIZI_SHOP's theme: the starter, published once
            if (
                !one('mantle.public.PublicThemeBinding', {
                    siteId: 'ZIZI_SHOP',
                    appMountId: 'shop',
                })
            ) {
                const themeId = l.run(T + 'create#ThemeDraft', {
                    productStoreId: 'POPC_DEFAULT',
                    starter: 'mr-pass/starter',
                }).themeId
                const { validationDigest } = l.run(T + 'validate#Theme', {
                    themeId,
                })
                l.run(T + 'publish#Theme', {
                    operationKey: 'SHOPHTTP-' + Date.now(),
                    themeId,
                    siteId: 'ZIZI_SHOP',
                    validationDigest,
                    expectedActiveRevision: 0,
                })
            }
            return {
                shop: lib().facade('getShopContext', { siteId: 'ZIZI_SHOP' }),
                digital: lib().facade('getShopContext', {
                    siteId: 'ZIZI_DIGITAL',
                }),
            }
        },
        then({ shop, digital }) {
            shop.result.store.productStoreId === 'POPC_DEFAULT'
            shop.result.release != null
            digital.result.store.productStoreId === 'BOSS_COM_DIGITAL'
            digital.result.release == null
        },
    },
)
