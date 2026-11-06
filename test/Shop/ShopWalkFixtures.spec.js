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
