// Shop's orders, account and downloads on PASS, and the PASS Account hub (impl-shop P6; design-shop §9, §10 Downloads; F6,
// F27, F82): a guest's order link reads its one order, the same through a remote frontend, and the emailed link's page keeps
// it in the session for that order and cleans the address; the order page (one render) links the site's Support pages
// with the order and its downloads; a remote frontend's download answers its range; the hub's one render shows the Shop and
// Billing cards of a verified buyer and the email preferences the store's cart reminders; P6's capability reads are POSTs in
// all three TOKEN_WRITES lists, Support's too, and only the relays' routes allow the provider's form-action. The rules are
// Mantle's (mr-mantle test/party/ShopCustomer, test/product/StoreFulfillment).
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const shopCheckout = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCheckout.js')
const SITE = 'PASS_SHOP_ACCOUNT',
    HOST = 'account.shop.example.test'
const ids = {
    guide: 'PSACC_GUIDE',
    store: 'PASS_SHOP_ACC_STORE',
    gateway: 'PSACC_HOSTED',
    buyer: 'PSACC_BUYER',
    file: 'dbresource://mr-pass/spec/psacc/guide.txt',
}
const state = {}
// one render under Pass.xml with request parameters (a link's query)
function renderWith(path, screenPath, parameters) {
    const rendered = ec.screen
        .makeTest()
        .rootScreen('component://mr-pass/screen/Pass.xml')
        .render(
            screenPath,
            {
                resolvedSiteId: SITE,
                publicHost: HOST,
                publicPath: path,
                ...parameters,
            },
            null,
        )
    return { html: rendered.output, errors: rendered.errorMessages }
}
// a guest buys the guide through the facade, as the pages do; {orderId, orderToken}
function buy(email) {
    const call = (operation, input) =>
        lib().facade(operation, { siteId: SITE, ...input })
    const token = call('addCartItem', { productId: ids.guide, quantity: '1' })
        .result.token
    call('beginCheckout', { token })
    call('setCheckoutContact', {
        token,
        emailAddress: email,
        name: 'Gwen Guest',
    })
    call('selectPayment', { token, paymentOptionId: 'PiCreditCard' })
    const view = call('getCheckout', { token }).result
    const submitted = call('submitCheckout', {
        token,
        expectedRevision: view.checkout.revision,
    }).result
    const row = ec.entity
        .find('mantle.order.StoreCheckout')
        .condition({ returnReference: submitted.checkout.reference })
        .disableAuthz()
        .one()
    lib().run('update#mantle.account.payment.PortalPaymentAttempt', {
        paymentId: row.paymentId,
        lastCheckDate: null,
    })
    call('getCheckoutPaymentResult', {
        reference: submitted.checkout.reference,
        key: submitted.returnKey,
    })
    const confirmation = call('getOrderConfirmation', { token }).result
    assert(ec.factory.waitWorkerPoolEmpty(50), 'Worker pool did not drain')
    return { orderId: row.orderId, orderToken: confirmation.orderToken }
}
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        l.run('create#mantle.product.store.ProductStore', {
            productStoreId: ids.store,
            storeName: 'Shop Spec Account Store',
            organizationPartyId: l.ids.org,
            defaultCurrencyUomId: 'USD',
            defaultLocale: 'en_US',
            requireInventory: 'N',
            defaultDisableShippingCalc: 'Y',
        })
        for (const settingTypeEnumId of [
            'PsstCheckoutTerms',
            'PsstOrdApproveNewCust',
            'PsstOrdApproveAddrMissing',
        ])
            l.run('create#mantle.product.store.ProductStoreSetting', {
                productStoreId: ids.store,
                settingTypeEnumId,
                fromDate: 0,
                settingValue: 'false',
            })
        l.run('create#mantle.account.method.PaymentGatewayConfig', {
            paymentGatewayConfigId: ids.gateway,
            paymentGatewayTypeEnumId: 'PgtTest',
            description: 'Spec hosted page',
            authorizeServiceName:
                'mantle.account.PaymentTestServices.hostedPending#PaymentAuthorization',
            captureServiceName:
                'mantle.account.PaymentTestServices.alwaysApprove#PaymentCapture',
            detailsServiceName:
                'mantle.account.PaymentTestServices.alwaysApprove#PaymentDetails',
        })
        l.run('create#mantle.account.method.PaymentGatewayOrganization', {
            organizationPartyId: l.ids.org,
            paymentGatewayConfigId: ids.gateway,
            fromDate: 0,
            isEnabled: 'Y',
        })
        l.run('create#mantle.product.store.ProductStorePaymentGateway', {
            productStoreId: ids.store,
            paymentInstrumentEnumId: 'PiCreditCard',
            paymentGatewayConfigId: ids.gateway,
        })
        l.site(SITE, HOST)
        l.mounts(SITE, [
            { app: 'account', pathPrefix: '/account' },
            { app: 'billing', pathPrefix: '/billing', targetId: l.ids.org },
            { app: 'support', pathPrefix: '/support', targetId: l.ids.org },
            { app: 'shop', pathPrefix: '/shop', targetId: ids.store },
        ])
        l.setState(SITE, 'published')
        setProperty(
            'pass_client_' + l.ids.client + '_secret',
            'pass-shop-spec-secret',
        )
        setProperty(
            'pass_client_' + l.ids.client + '_sites',
            'PASS_SHOP_CAT,PASS_SHOP_CART,PASS_SHOP_CHECKOUT,' + SITE,
        )
        l.run('create#mantle.product.Product', {
            productId: ids.guide,
            productName: 'Spec account guide',
            productTypeEnumId: 'PtDigital',
        })
        l.run('create#mantle.product.ProductPrice', {
            productId: ids.guide,
            pricePurposeEnumId: 'PppPurchase',
            priceTypeEnumId: 'PptCurrent',
            fromDate: 0,
            minQuantity: 1,
            price: '10.00',
            priceUomId: 'USD',
        })
        l.run('create#mantle.product.store.ProductStoreProduct', {
            productStoreId: ids.store,
            productId: ids.guide,
            fromDate: 0,
        })
        const was = ec.artifactExecution.disableAuthz()
        ec.resource
            .getLocationReference(ids.file)
            .putText('The spec guide, version one.')
        if (!was) ec.artifactExecution.enableAuthz()
        l.run('create#mantle.product.ProductContent', {
            productId: ids.guide,
            productContentTypeEnumId: 'PcntDownload',
            contentLocation: ids.file,
            description: 'guide.txt',
            fromDate: 0,
        })
        // a verified buyer account of the second purchase's email
        l.run('create#mantle.party.Party', {
            partyId: ids.buyer,
            partyTypeEnumId: 'PtyPerson',
        })
        l.run('create#mantle.party.Person', {
            partyId: ids.buyer,
            firstName: 'Bea',
            lastName: 'Buyer',
        })
        l.run('create#moqui.security.UserAccount', {
            userId: ids.buyer,
            username: ids.buyer,
            partyId: ids.buyer,
            emailAddress: 'bea@psacc.example.test',
            currentPassword: '16ac58bbfa332c1c55bd98b53e60720bfa90d394',
            passwordHashType: 'SHA',
            timeZone: 'UTC',
        })
        l.run('create#moqui.security.public.VerifiedAddress', {
            userId: ids.buyer,
            emailAddress: 'bea@psacc.example.test',
            verifiedAt: ec.user.nowTimestamp,
        })
        logout()
        state.guest = buy('gwen@psacc.example.test')
        state.buyer = buy('bea@psacc.example.test')
        login('john.doe')
    },
    cleanup() {
        ec.web.sessionAttributes.remove(shopCheckout().ordersKey(SITE))
        login('john.doe')
    },
})
feature(
    "a guest's order link reads its one order, locally and remotely; its page links Support and downloads",
    {
        when() {
            logout()
            try {
                const local = lib().facade('getShopOrder', {
                    siteId: SITE,
                    orderToken: state.guest.orderToken,
                })
                const remote = lib().remote('getShopOrder', {
                    siteId: SITE,
                    orderToken: state.guest.orderToken,
                })
                const other = lib().facade('getShopOrder', {
                    siteId: SITE,
                    orderToken: state.guest.orderToken,
                    orderId: state.buyer.orderId,
                })
                const remoteOther = lib().remote('getShopOrder', {
                    siteId: SITE,
                    orderToken: state.guest.orderToken,
                    orderId: state.buyer.orderId,
                })
                // the emailed link's page: kept for its order, and the order's page opened without it
                const status = renderWith(
                    '/shop/Orders/Status',
                    'Shop/Orders/Status',
                    { token: state.guest.orderToken },
                )
                const kept = shopCheckout().orderLinkOf(
                    SITE,
                    state.guest.orderId,
                )
                const route = lib().route(
                    SITE,
                    HOST,
                    '/shop/Orders/' + state.guest.orderId,
                )
                const detail = renderWith(
                    '/shop/Orders/' + state.guest.orderId,
                    'Shop/Orders/OrderDetail',
                    { orderId: state.guest.orderId },
                )
                // a remote frontend's download of the order's file answers its range
                const grant = lib().facade('getDownloads', {
                    siteId: SITE,
                    orderToken: state.guest.orderToken,
                }).result.downloads[0]
                const issued = lib().remote('issueDownload', {
                    siteId: SITE,
                    orderToken: state.guest.orderToken,
                    downloadGrantId: grant.downloadGrantId,
                })
                const file = ec.resource
                    .script('component://mr-mantle/script/PassAuthority.js')
                    .handle({
                        operation: 'getShopDownload',
                        siteId: SITE,
                        input: {
                            downloadGrantId: grant.downloadGrantId,
                            downloadToken: issued.result.downloadToken,
                            range: 'bytes=4-7',
                        },
                        clientId: lib().ids.client,
                        clientVerified: true,
                    })
                return {
                    local,
                    remote,
                    other,
                    remoteOther,
                    status,
                    kept,
                    route,
                    detail,
                    grant,
                    file,
                }
            } finally {
                login('john.doe')
            }
        },
        then(r) {
            r.local.result.order.orderId == state.guest.orderId
            r.remote.result.order.orderId == state.guest.orderId
            r.remote.result.order.totals.total.amount ==
                r.local.result.order.totals.total.amount
            r.other.kind == 'NotFound'
            r.remoteOther.kind == 'NotFound'
            r.status.errors.length == 0
            r.kept == state.guest.orderToken
            r.route == '/Shop/Orders/OrderDetail'
            r.detail.errors.length == 0
            r.detail.html.includes('Order ' + state.guest.orderId)
            r.detail.html.includes(
                '/support/RequestReturn?orderId=' + state.guest.orderId,
            )
            r.detail.html.includes(
                '/support/NewCustomerCase?orderId=' + state.guest.orderId,
            )
            r.detail.html.includes('Download your files')
            !r.detail.html.includes(state.guest.orderToken)
            r.grant.available == true
            r.file.download.range.start == 4 && r.file.download.range.end == 7
            r.file.download.size > 8
            !JSON.stringify(r.file.result).includes('dbresource')
        },
    },
)
feature(
    "the hub shows a verified buyer's Shop and Billing cards; email preferences offer the store's cart reminders",
    {
        when() {
            login(ids.buyer)
            try {
                const hub = lib().render(
                    SITE,
                    HOST,
                    '/account/Home',
                    'Account/Home',
                )
                const preferences = lib().render(
                    SITE,
                    HOST,
                    '/account/EmailPreferences',
                    'Account/EmailPreferences',
                )
                return { hub, preferences }
            } finally {
                login('john.doe')
            }
        },
        then({ hub, preferences }) {
            hub.errors.length == 0
            hub.html.includes('id="AccountCard_shop"')
            hub.html.includes('1 order')
            hub.html.includes('id="AccountCard_billing"')
            hub.html.includes('Email preferences')
            preferences.errors.length == 0
            preferences.html.includes(
                'Cart reminders from Shop Spec Account Store',
            )
            preferences.html.includes(
                'name="topic_cartReminders:' + ids.store + '"',
            )
            // and its review requests (Commerce P9 follow-up)
            preferences.html.includes(
                'Review requests from Shop Spec Account Store',
            )
            preferences.html.includes(
                'name="topic_reviewRequests:' + ids.store + '"',
            )
        },
    },
)
feature(
    "P6's capability reads are POSTs in the three token lists, Support's too; only the relays allow the provider",
    {
        when() {
            const transport = ec.resource.script(
                'component://mr-pass/service/pass/Transport.js',
            )
            const lists = [
                transport.TOKEN_WRITES,
                ec.resource.script('component://mr-mantle/script/PassApi.js')
                    .TOKEN_WRITES,
                ec.resource.script(
                    'component://mr-mantle/script/PassAuthority.js',
                ).TOKEN_WRITES,
            ]
            const routes = ec.resource.script(
                'component://mr-pass/service/pass/Routes.js',
            )
            const headers = ec.resource.script(
                'component://mr-pass/screen/Shared/Headers.js',
            )
            const posted = [
                'findShopOrders',
                'getShopOrder',
                'getShopOrderDocument',
                'getDownloads',
                'issueDownload',
                'getEmailPreferences',
                'getCaseIntake',
                'getReturnableOrder',
            ].every(
                (op) =>
                    lists[0].includes(op) &&
                    routes.find((route) => route[2] === op)[0] === 'POST',
            )
            return { lists, routes, headers, posted }
        },
        then({ lists, routes, headers, posted }) {
            JSON.stringify(lists[0]) == JSON.stringify(lists[1]) &&
                JSON.stringify(lists[1]) == JSON.stringify(lists[2])
            posted == true
            routes.find((route) => route[2] === 'getShopDownload')[0] === 'GET'
            headers
                .policyOf('shop', '/MethodRelay', false)
                .formAction.includes('https://accept.authorize.net')
            headers.policyOf('shop', '/Orders', false).formAction.length == 0
        },
    },
)
