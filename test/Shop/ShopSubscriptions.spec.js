// Shop's subscription pages on PASS (impl-shop P7; design-shop §10 Subscriptions, SubscriptionDetail, §4.3): the store's
// offer points the site's subscription address at Shop's Subscriptions page (the Forum's "Manage your subscription") and
// leaves another site's outside address alone; a verified buyer's list and detail (one render each) show billing and
// access apart with the detail's forms, the detail routed from Subscriptions/{contractId}; a visitor is asked to sign in,
// locally and through a remote frontend alike; the operations are the account's own (in Schema and Routes with their
// Mantle mirrors, never token writes) and the checkout's submit takes the renewal consent. The rules are Mantle's
// (mr-mantle test/product/ShopSubscriptions).
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const SITE = 'PASS_SHOP_SUBS',
    HOST = 'subs.shop.example.test',
    OTHER = 'PASS_SHOP_SUBS_OUT',
    OTHER_HOST = 'subs-out.shop.example.test'
const ids = {
    store: 'PASS_SHOP_SUBS_STORE',
    product: 'PSSUB_MONTH',
    resource: 'PSSUB_RES',
    gateway: 'PSSUB_HOSTED',
    buyer: 'PSSUB_BUYER',
    contract: 'PSSUB_CONTRACT',
}
const state = {}
function renderAs(username, path, screenPath, parameters) {
    if (username) login(username)
    else logout()
    try {
        const rendered = ec.screen
            .makeTest()
            .rootScreen('component://mr-pass/screen/Pass.xml')
            .render(
                screenPath,
                {
                    resolvedSiteId: SITE,
                    publicHost: HOST,
                    publicPath: path,
                    ...(parameters || {}),
                },
                null,
            )
        return { html: rendered.output, errors: rendered.errorMessages }
    } finally {
        login('john.doe')
    }
}
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        l.run('create#mantle.product.store.ProductStore', {
            productStoreId: ids.store,
            storeName: 'Shop Spec Subscriptions',
            organizationPartyId: l.ids.org,
            defaultCurrencyUomId: 'USD',
            defaultLocale: 'en_US',
            requireInventory: 'N',
        })
        l.run('create#mantle.account.method.PaymentGatewayConfig', {
            paymentGatewayConfigId: ids.gateway,
            paymentGatewayTypeEnumId: 'PgtTest',
            description: 'Spec hosted page with renewals',
            authorizeServiceName:
                'mantle.account.PaymentTestServices.hostedPendingOrApprove#PaymentAuthorization',
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
        for (const [siteId, hostname] of [
            [SITE, HOST],
            [OTHER, OTHER_HOST],
        ]) {
            l.site(siteId, hostname)
            l.mounts(siteId, [
                { app: 'account', pathPrefix: '/account' },
                { app: 'shop', pathPrefix: '/shop', targetId: ids.store },
            ])
            l.setState(siteId, 'published')
        }
        // the other site's owner manages subscriptions elsewhere
        l.run('update#mantle.public.PublicSite', {
            siteId: OTHER,
            subscriptionUrl: 'https://members.example.test/manage',
        })
        l.run('create#mantle.product.Product', {
            productId: ids.product,
            productName: 'Spec monthly access',
            productTypeEnumId: 'PtDigital',
        })
        l.run('create#mantle.product.subscription.SubscriptionResource', {
            subscriptionResourceId: ids.resource,
            description: 'Spec access',
        })
        l.run(
            'create#mantle.product.subscription.ProductSubscriptionResource',
            {
                productId: ids.product,
                subscriptionResourceId: ids.resource,
                fromDate: 0,
                availableTime: 1,
                availableTimeUomId: 'TF_mon',
            },
        )
        l.run('create#mantle.party.Party', {
            partyId: ids.buyer,
            partyTypeEnumId: 'PtyPerson',
        })
        l.run('create#mantle.party.Person', {
            partyId: ids.buyer,
            firstName: 'Sam',
            lastName: 'Subscriber',
        })
        l.run('create#moqui.security.UserAccount', {
            userId: ids.buyer,
            username: ids.buyer,
            partyId: ids.buyer,
            emailAddress: 'sam@pssub.example.test',
            currentPassword: '16ac58bbfa332c1c55bd98b53e60720bfa90d394',
            passwordHashType: 'SHA',
            timeZone: 'UTC',
        })
        l.run('create#moqui.security.public.VerifiedAddress', {
            userId: ids.buyer,
            emailAddress: 'sam@pssub.example.test',
            verifiedAt: ec.user.nowTimestamp,
        })
        state.offerId = l.run(
            'mantle.product.ShopSubscriptionServices.store#RecurringOffer',
            {
                productStoreId: ids.store,
                productId: ids.product,
                offerName: 'Spec monthly',
                priceAmount: '9.00',
                autoRenew: 'Y',
                termsVersion: '1',
            },
        ).offerId
        // the buyer's cancelled subscription, its paid term still running (the purchase itself is Mantle's spec)
        const now = Number(ec.user.nowTimestamp)
        l.run('create#mantle.product.subscription.StoreRecurringContract', {
            contractId: ids.contract,
            productStoreId: ids.store,
            siteId: SITE,
            customerPartyId: ids.buyer,
            offerId: state.offerId,
            productId: ids.product,
            subscriptionResourceId: ids.resource,
            priceAmount: '9.00',
            currencyUomId: 'USD',
            autoRenew: 'Y',
            stateEnumId: 'ScsCancelled',
            paidThroughDate: new Date(now + 20 * 86400000),
            cancelDate: ec.user.nowTimestamp,
            cancelAtDate: new Date(now + 20 * 86400000),
            revision: 2,
            createdDate: ec.user.nowTimestamp,
        })
        l.run('create#mantle.product.subscription.Subscription', {
            subscriptionId: 'PSSUB_TERM',
            subscriptionTypeEnumId: 'StProduct',
            subscriptionResourceId: ids.resource,
            subscriberPartyId: ids.buyer,
            productId: ids.product,
            resourceInstanceId: ids.contract,
            fromDate: new Date(now - 10 * 86400000),
            thruDate: new Date(now + 20 * 86400000),
        })
    },
    cleanup() {
        login('john.doe')
    },
})
feature(
    "the offer points the site at Shop's page; a buyer's list and detail show billing and access apart; a visitor signs in",
    {
        when() {
            const site = lib().siteRow(SITE)
            const other = lib().siteRow(OTHER)
            const list = renderAs(
                ids.buyer,
                '/shop/Subscriptions',
                'Shop/Subscriptions/SubscriptionList',
            )
            const route = lib().route(
                SITE,
                HOST,
                '/shop/Subscriptions/' + ids.contract,
            )
            const detail = renderAs(
                ids.buyer,
                '/shop/Subscriptions/' + ids.contract,
                'Shop/Subscriptions/SubscriptionDetail',
                { contractId: ids.contract },
            )
            logout()
            const visitor = lib().facade('getSubscriptions', { siteId: SITE })
            const remoteVisitor = lib().remote('getSubscriptions', {
                siteId: SITE,
            })
            login('john.doe')
            return { site, other, list, route, detail, visitor, remoteVisitor }
        },
        then({ site, other, list, route, detail, visitor, remoteVisitor }) {
            site.subscriptionUrl == 'https://' + HOST + '/shop/Subscriptions'
            other.subscriptionUrl == 'https://members.example.test/manage'
            list.errors.length == 0
            list.html.includes('id="SubscriptionList"')
            list.html.includes('Renewal cancelled')
            list.html.includes('Access until')
            list.html.includes('/shop/Subscriptions/' + ids.contract)
            list.html.includes('Subscribe')
            !list.html.includes('Error rendering')
            route == '/Shop/Subscriptions/SubscriptionDetail'
            detail.errors.length == 0
            detail.html.includes('id="RenewalHistory"')
            detail.html.includes('Spec monthly')
            // cancelled: no cancel form, the access kept
            !detail.html.includes('id="CancelRenewal"')
            detail.html.includes('Access until')
            !detail.html.includes('Error rendering')
            visitor.kind == 'AuthenticationRequired'
            remoteVisitor.kind == 'AuthenticationRequired'
        },
    },
)
feature(
    "the subscription operations are the account's own, mirrored, never token writes; the submit takes the consent",
    {
        when() {
            const names = [
                'getSubscriptions',
                'getSubscription',
                'beginSubscriptionPurchase',
                'changeSubscriptionMethod',
                'cancelSubscription',
                'resumeRenewal',
            ]
            const schema = ec.resource.script(
                'component://mr-pass/service/pass/Schema.js',
            )
            const mirror = ec.resource.script(
                'component://mr-mantle/service/mantle/forum/ForumSchema.js',
            )
            const routes = ec.resource.script(
                'component://mr-pass/service/pass/Routes.js',
            )
            const lists = [
                ec.resource.script(
                    'component://mr-pass/service/pass/Transport.js',
                ).TOKEN_WRITES,
                ec.resource.script('component://mr-mantle/script/PassApi.js')
                    .TOKEN_WRITES,
                ec.resource.script(
                    'component://mr-mantle/script/PassAuthority.js',
                ).TOKEN_WRITES,
            ]
            return { names, schema, mirror, routes, lists }
        },
        then({ names, schema, mirror, routes, lists }) {
            names.every(
                (name) =>
                    String(schema[name]?.service).startsWith(
                        'mantle.product.ShopSubscriptionServices.',
                    ) && schema[name].service == mirror[name]?.service,
            )
            names.every((name) =>
                Array.from(routes).some((route) => route[2] == name),
            )
            names.every((name) =>
                lists.every((list) => !Array.from(list).includes(name)),
            )
            schema.submitCheckout.fields.includes('recurringConsent')
        },
    },
)
