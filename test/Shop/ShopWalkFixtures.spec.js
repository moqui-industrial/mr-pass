// Shop's golden-path walk's data (impl-shop P5; test/client/Shop/ShopCheckoutWalk): on the HTTP test community (PASS_HTTP,
// from ClientFixtures, its Billing and Supplier mounts from PortalFixtures), a Shop mount at /shop for a store of the
// spec's organization, with a published digital guide, the hosted test gateway (its page returns the payer, its lookup
// approves) and no terms to accept. The PASS shell renders it (no theme). Each record is made once.
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const ids = {
    store: 'PASS_WALK_STORE',
    guide: 'PASS_WALK_GUIDE',
    gateway: 'PASS_WALK_HOSTED',
}
spec({
    dependsOn: ['ClientFixtures'],
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
    },
    cleanupSpec() {
        ec.artifactExecution.enableAuthz()
    },
})
feature("provision PASS_HTTP's Shop with a guide and a hosted test gateway", {
    when() {
        const l = lib()
        l.records()
        const once = (entity, key, values) => {
            if (!ec.entity.find(entity).condition(key).one())
                l.run('create#' + entity, { ...key, ...(values || {}) })
        }
        once(
            'mantle.product.store.ProductStore',
            { productStoreId: ids.store },
            {
                storeName: 'Walk Store',
                organizationPartyId: l.ids.org,
                defaultCurrencyUomId: 'USD',
                defaultLocale: 'en_US',
                requireInventory: 'N',
                defaultDisableShippingCalc: 'Y',
            },
        )
        once(
            'mantle.product.store.ProductStoreSetting',
            {
                productStoreId: ids.store,
                settingTypeEnumId: 'PsstCheckoutTerms',
                fromDate: new Date(0),
            },
            { settingValue: 'false' },
        )
        once(
            'mantle.account.method.PaymentGatewayConfig',
            { paymentGatewayConfigId: ids.gateway },
            {
                paymentGatewayTypeEnumId: 'PgtTest',
                description: 'Walk payment page',
                authorizeServiceName:
                    'mantle.account.PaymentTestServices.hostedPending#PaymentAuthorization',
                captureServiceName:
                    'mantle.account.PaymentTestServices.alwaysApprove#PaymentCapture',
                detailsServiceName:
                    'mantle.account.PaymentTestServices.alwaysApprove#PaymentDetails',
            },
        )
        once(
            'mantle.account.method.PaymentGatewayOrganization',
            {
                organizationPartyId: l.ids.org,
                paymentGatewayConfigId: ids.gateway,
            },
            { fromDate: 0, isEnabled: 'Y' },
        )
        once(
            'mantle.product.store.ProductStorePaymentGateway',
            {
                productStoreId: ids.store,
                paymentInstrumentEnumId: 'PiCreditCard',
            },
            { paymentGatewayConfigId: ids.gateway },
        )
        once(
            'mantle.product.Product',
            { productId: ids.guide },
            { productName: 'Walk field guide', productTypeEnumId: 'PtDigital' },
        )
        once(
            'mantle.product.ProductPrice',
            {
                productId: ids.guide,
                pricePurposeEnumId: 'PppPurchase',
                priceTypeEnumId: 'PptCurrent',
                priceUomId: 'USD',
            },
            { fromDate: 0, minQuantity: 1, price: '15.00' },
        )
        once('mantle.product.store.ProductStoreProduct', {
            productStoreId: ids.store,
            productId: ids.guide,
            fromDate: new Date(0),
        })
        if (
            !ec.entity
                .find('mantle.public.PublicSiteApp')
                .condition({ siteId: 'PASS_HTTP', app: 'shop' })
                .one()
        )
            l.run('mantle.public.SiteServices.store#Mounts', {
                input: {
                    siteId: 'PASS_HTTP',
                    expectedRevision: Number(
                        l.siteRow('PASS_HTTP').policyRevision,
                    ),
                    mounts: [
                        { app: 'forum', pathPrefix: '/forum' },
                        { app: 'account', pathPrefix: '/account' },
                        { app: 'members', pathPrefix: '/members' },
                        { app: 'sites', pathPrefix: '/sites' },
                        {
                            app: 'shop',
                            pathPrefix: '/shop',
                            targetId: ids.store,
                        },
                    ],
                },
            })
        return {
            mount: ec.entity
                .find('mantle.public.PublicSiteApp')
                .condition({ siteId: 'PASS_HTTP', app: 'shop' })
                .one(),
        }
    },
    then({ mount }) {
        mount.targetId == ids.store
        mount.enabled == 'Y'
    },
})
// The security proofs' theme preview (test/proofs V3WebFrontend, v5.0.0-3.5.5), set again on every run: here, as the
// walk's store it previews is made here (after ClientFixtures, its site's). A draft of the starter theme for the store,
// PASS_HTTP's preview host (preview.pass-http.localhost, served by test/MoquiConf.xml's public-site of that name), and a
// preview of the home page by the owner john.doe, good for an hour from this run, whose token is known here and in the
// proof: its digest is stored as create#ThemePreview stores one (sha256), as the editor's link would hold the token.
const PREVIEW_HOST = 'preview.pass-http.localhost',
    PREVIEW_TOKEN = 'PassProofPreviewToken'.padEnd(40, '0')
feature("the security proofs' theme preview is made or set again", {
    when() {
        const l = lib()
        const upsert = (entity, key, values) => {
            const old = ec.entity.find(entity).condition(key).one()
            if (old) {
                old.setAll(values)
                old.update()
            } else l.run('create#' + entity, { ...key, ...values })
        }
        upsert('mantle.public.PublicSiteHost', { hostname: PREVIEW_HOST }, {
            siteId: 'PASS_HTTP',
            canonical: 'N',
            hostKindEnumId: 'PshkPreview',
        })
        const themeOf = () => ec.entity.find('mantle.public.PublicTheme').condition({ productStoreId: ids.store }).list()[0]
        if (!themeOf())
            l.run('mantle.public.ThemeServices.create#ThemeDraft', { productStoreId: ids.store, starter: 'mr-pass/starter' })
        const theme = themeOf()
        const mount = ec.entity.find('mantle.public.PublicSiteApp').condition({ siteId: 'PASS_HTTP', app: 'shop' }).one()
        const now = ec.user.timestampMillis(ec.user.nowTimestamp)
        upsert('mantle.public.PublicThemePreview', { previewId: 'PASS_PROOF_PREVIEW' }, {
            themeId: theme.themeId,
            siteId: 'PASS_HTTP',
            appMountId: mount.appMountId,
            userId: ec.user.userId,
            tokenDigest: ec.resource.digestText(PREVIEW_TOKEN, 'sha256'),
            pageKind: 'home',
            draftRevision: Number(theme.draftRevision || 0),
            expireDate: new Date(now + 3600000),
            createdDate: new Date(now),
        })
        return {
            host: ec.entity.find('mantle.public.PublicSiteHost').condition({ hostname: PREVIEW_HOST }).one(),
            preview: ec.entity.find('mantle.public.PublicThemePreview').condition({ previewId: 'PASS_PROOF_PREVIEW' }).one(),
            theme,
        }
    },
    then({ host, preview, theme }) {
        host.siteId === 'PASS_HTTP'
        host.hostKindEnumId === 'PshkPreview'
        preview.themeId === theme.themeId
        theme.productStoreId === ids.store
    },
})
