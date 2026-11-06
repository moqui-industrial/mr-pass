// Shop's checkout on PASS (impl-shop P5; design-shop §6 Checkout, PaymentResult, OrderConfirmation, §7.3, §13.1; F37, F71,
// F75): the checkout page's one render through the published starter theme (its steps as plain forms with the revision
// and operation id, the review's submit with the store's optional emails unchecked, never a capability); only the payment relay's route allows the provider's
// form-action; the checkout's writes and capability reads (POSTs) in all three TOKEN_WRITES lists, with getCart a POST;
// a remote frontend's checkout, its refusal of a stale submit, its submit and a provider's return read by the reference
// and key alone, the same as a local page's; a sign-in on a Shop site landing on its root app. The checkout's rules are
// Mantle's (mr-mantle test/order/ShopCheckout).
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const shopCart = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCart.js')
const shopCheckout = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCheckout.js')
const T = 'mantle.public.ThemeServices.'
const SITE = 'PASS_SHOP_CHECKOUT',
    HOST = 'checkout.shop.example.test'
const ids = {
    book: 'PSCHK_BOOK',
    store: 'PASS_SHOP_CHK_STORE',
    gateway: 'PSCHK_HOSTED',
}
const state = {}
const context = () => lib().facade('getShopContext', { siteId: SITE }).result
const CHECKOUT_OPS = [
    'beginCheckout',
    'getCheckout',
    'resumeCheckout',
    'setCheckoutContact',
    'setCheckoutAddresses',
    'getDeliveryOptions',
    'selectDelivery',
    'getPaymentOptions',
    'selectPayment',
    'submitCheckout',
    'getCheckoutPaymentResult',
    'getCheckoutPaymentForm',
    'getOrderConfirmation',
]
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        l.run('create#mantle.product.store.ProductStore', {
            productStoreId: ids.store,
            storeName: 'Shop Spec Checkout Store',
            organizationPartyId: l.ids.org,
            defaultCurrencyUomId: 'USD',
            defaultLocale: 'en_US',
            requireInventory: 'N',
            defaultDisableShippingCalc: 'Y',
        })
        l.run('create#mantle.product.store.ProductStoreSetting', {
            productStoreId: ids.store,
            settingTypeEnumId: 'PsstCheckoutTerms',
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
            { app: 'shop', pathPrefix: '/shop', targetId: ids.store },
        ])
        l.setState(SITE, 'published')
        setProperty(
            'pass_client_' + l.ids.client + '_secret',
            'pass-shop-spec-secret',
        )
        setProperty(
            'pass_client_' + l.ids.client + '_sites',
            'PASS_SHOP_CAT,PASS_SHOP_CART,' + SITE,
        )
        l.run('create#mantle.product.Product', {
            productId: ids.book,
            productName: 'Spec checkout guide',
            productTypeEnumId: 'PtDigital',
        })
        l.run('create#mantle.product.ProductPrice', {
            productId: ids.book,
            pricePurposeEnumId: 'PppPurchase',
            priceTypeEnumId: 'PptCurrent',
            fromDate: 0,
            minQuantity: 1,
            price: '10.00',
            priceUomId: 'USD',
        })
        l.run('create#mantle.product.store.ProductStoreProduct', {
            productStoreId: ids.store,
            productId: ids.book,
            fromDate: 0,
        })
        const themeId = l.run(T + 'create#ThemeDraft', {
            productStoreId: ids.store,
            starter: 'mr-pass/starter',
        }).themeId
        const { validationDigest } = l.run(T + 'validate#Theme', { themeId })
        state.release = l.run(T + 'publish#Theme', {
            operationKey:
                'SHOPCHK-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
            themeId,
            siteId: SITE,
            validationDigest,
            expectedActiveRevision: 0,
        })
    },
    cleanup() {
        ec.web.sessionAttributes.remove(shopCart().tokenKey(SITE))
        login('john.doe')
    },
})
feature(
    "the checkout page renders its steps through the theme's checkout component; only the relay's route allows the provider",
    {
        when() {
            logout()
            try {
                const c = context()
                shopCart().call(c, 'addCartItem', {
                    productId: ids.book,
                    quantity: '1',
                })
                shopCart().call(c, 'beginCheckout', {})
                shopCart().call(c, 'setCheckoutContact', {
                    emailAddress: 'reader@shop.example.test',
                    name: 'Rita Reader',
                })
                shopCart().call(c, 'selectPayment', {
                    paymentOptionId: 'PiCreditCard',
                })
                const rendered = ec.screen
                    .makeTest()
                    .rootScreen('component://mr-pass/screen/Pass.xml')
                    .render(
                        'Shop/Checkout',
                        {
                            resolvedSiteId: SITE,
                            publicHost: HOST,
                            publicPath: '/shop/Checkout',
                        },
                        null,
                    )
                const headers = ec.resource.script(
                    'component://mr-pass/screen/Shared/Headers.js',
                )
                return {
                    token: ec.web.sessionAttributes[shopCart().tokenKey(SITE)],
                    html: rendered.output,
                    errors: rendered.errorMessages,
                    relay: headers.csp(
                        headers.policyOf('shop', '/PaymentRelay', false),
                    ),
                    checkout: headers.csp(
                        headers.policyOf('shop', '/Checkout', false),
                    ),
                    relayCache: headers.policyOf('shop', '/PaymentRelay', false)
                        .cacheControl,
                }
            } finally {
                login('john.doe')
            }
        },
        then({ token, html, errors, relay, checkout, relayCache }) {
            errors.length == 0
            html.includes(
                'href="/shop/theme/' +
                    state.release.manifestDigest +
                    '/store.css"',
            )
            html.includes('id="ShopCheckout"')
            html.includes('action="/shop/Checkout/contact"')
            html.includes('value="reader@shop.example.test"')
            html.includes('action="/shop/Checkout/payment"')
            html.includes('Spec hosted page')
            html.includes('action="/shop/Checkout/submit"')
            html.includes('Place order and pay $10.00')
            // the store's optional emails (Commerce P9 follow-up): a guest is offered review requests, unchecked, with what
            // it is and is not; no cart reminders without an account
            html.includes('name="optIn" value="reviewRequests">')
            html.includes(
                'One email per item after it arrives; no offers or newsletters.',
            )
            !html.includes('value="cartReminders"')
            html.includes('name="expectedRevision"')
            html.includes('name="operationId"')
            !html.includes('Delivery address')
            !html.includes(token)
            !html.includes(ids.gateway)
            relay.includes(
                "form-action 'self' https://accept.authorize.net https://test.authorize.net",
            )
            checkout.includes("form-action 'self';")
            !checkout.includes('authorize.net')
            relayCache == 'no-store'
        },
    },
)
feature(
    "checkout operations are capability writes; a remote frontend's checkout, refusal, submit and return equal a local page's",
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
            const routed = (operation, input) => {
                try {
                    return transport.routeOf(operation, input).method
                } catch (error) {
                    return error.moquiErrorKind
                }
            }
            logout()
            try {
                const token = lib().remote('addCartItem', {
                    siteId: SITE,
                    productId: ids.book,
                    quantity: '2',
                }).result.token
                const remote = (operation, input) =>
                    lib().remote(operation, { siteId: SITE, ...input })
                remote('beginCheckout', { token })
                remote('setCheckoutContact', {
                    token,
                    emailAddress: 'remote@shop.example.test',
                    name: 'Remy Remote',
                })
                remote('selectPayment', {
                    token,
                    paymentOptionId: 'PiCreditCard',
                })
                const remoteView = remote('getCheckout', { token })
                const localView = lib().facade('getCheckout', {
                    siteId: SITE,
                    token,
                })
                const remoteStale = remote('submitCheckout', {
                    token,
                    expectedRevision: '0',
                })
                const localStale = lib().facade('submitCheckout', {
                    siteId: SITE,
                    token,
                    expectedRevision: '0',
                })
                const submitted = remote('submitCheckout', {
                    token,
                    expectedRevision: remoteView.result.checkout.revision,
                })
                const reference = submitted.result.checkout.reference
                const key = submitted.result.returnKey
                return {
                    lists,
                    routes: ec.resource.script(
                        'component://mr-pass/service/pass/Routes.js',
                    ),
                    anonymousCart: routed('getCart', { siteId: SITE }),
                    returnRead: routed('getCheckoutPaymentResult', {
                        siteId: SITE,
                        reference: 'x',
                        key: 'k',
                    }),
                    submitWithout: routed('submitCheckout', { siteId: SITE }),
                    remoteView,
                    localView,
                    remoteStale,
                    localStale,
                    submitted,
                    // a provider's return on another frontend session (a moment after the submit): the reference and key
                    // only, no cart capability
                    returned: (() => {
                        const row = ec.entity
                            .find('mantle.order.StoreCheckout')
                            .condition({ returnReference: reference })
                            .disableAuthz()
                            .one()
                        lib().run(
                            'update#mantle.account.payment.PortalPaymentAttempt',
                            { paymentId: row.paymentId, lastCheckDate: null },
                        )
                        return remote('getCheckoutPaymentResult', {
                            reference,
                            key,
                        })
                    })(),
                    // Shop P6 (F85): the reference and key alone read the order's state, and no order link; the cart's
                    // own session (its placed cart's capability) the confirmation and the link
                    byReference: remote('getOrderConfirmation', {
                        reference,
                        key,
                    }),
                    confirmation: remote('getOrderConfirmation', {
                        reference,
                        key,
                        token,
                    }),
                    noKey: remote('getCheckoutPaymentResult', { reference }),
                }
            } finally {
                login('john.doe')
            }
        },
        then(r) {
            JSON.stringify(r.lists[0]) === JSON.stringify(r.lists[1])
            JSON.stringify(r.lists[1]) === JSON.stringify(r.lists[2])
            CHECKOUT_OPS.concat(['getCart']).every((operation) =>
                r.lists[0].includes(operation),
            )
            // every checkout read and getCart is a POST (F75): a capability is never a query parameter
            CHECKOUT_OPS.concat(['getCart']).every(
                (operation) =>
                    r.routes.find((route) => route[2] == operation)[0] ==
                    'POST',
            )
            r.anonymousCart == 'POST'
            r.returnRead == 'POST'
            r.submitWithout == 'AuthenticationRequired'
            JSON.stringify(r.remoteView.result.checkout) ===
                JSON.stringify(r.localView.result.checkout)
            r.remoteView.result.checkout.state == 'ready'
            r.remoteStale.kind == 'Conflict'
            r.remoteStale.reason == 'staleRevision'
            r.remoteStale.message == r.localStale.message
            r.submitted.result.checkout.state == 'paymentPending'
            r.submitted.result.returnKey.length == 40
            r.submitted.result.checkout.attempt.providerUrl.startsWith(
                'https://' + HOST + '/shop/Checkout/return?ref=',
            )
            r.returned.result.checkout.state == 'completed'
            r.byReference.result.confirmation.minimal == true
            !r.byReference.result.orderToken
            r.confirmation.result.confirmation.totals.total.amount == '20.00'
            r.confirmation.result.orderToken.length == 48
            r.noKey.kind == 'NotFound'
        },
    },
)
feature('a sign-in on a site lands on its root app, else its Forum (F71)', {
    when() {
        const account = ec.resource.script(
            'component://mr-pass/service/pass/Account.js',
        )
        return {
            shopRoot: account.landing({
                mounts: [
                    { app: 'shop', pathPrefix: '/' },
                    { app: 'account', pathPrefix: '/account' },
                ],
            }),
            forum: account.landing({
                mounts: [
                    { app: 'forum', pathPrefix: '/forum' },
                    { app: 'shop', pathPrefix: '/shop' },
                ],
            }),
            neither: account.landing({
                mounts: [{ app: 'shop', pathPrefix: '/shop' }],
            }),
        }
    },
    then({ shopRoot, forum, neither }) {
        shopRoot == '/'
        forum == '/forum'
        neither == '/'
    },
})
