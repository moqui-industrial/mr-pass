// Shop P8's "usable when" (impl-shop P8; design-shop §17.1, §18.1 "Rollback and withdrawal", "Partial failures"), on the demo
// store POPC_DEFAULT and ShopFixtures' ZIZI_SHOP: adopting POPC_DEFAULT's categories (its publication rows set aside for the
// feature, then put back) previews its template roles with their conversion findings and proposes publication rows,
// writing nothing, and a publisher approves them; withdrawing the Shop mount leaves the placed orders as they are and the
// reconciliation job still places an open attempt's order; a remote frontend whose authority is down serves neither the
// site information it kept nor a personal page. Needs mr-mantle's StoreAdoptionServices (no BOSS); named to run after
// ShopFixtures (impl-commerce F106).
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const SITE = 'ZIZI_SHOP'
const STORE = 'POPC_DEFAULT'
const PSP = 'mantle.product.store.ProductStoreProduct'
const list = (entity, fields) =>
    Array.from(
        ec.entity
            .find(entity)
            .condition(fields)
            .useCache(false)
            .disableAuthz()
            .list(),
    )
const one = (entity, fields) =>
    ec.entity
        .find(entity)
        .condition(fields)
        .useCache(false)
        .disableAuthz()
        .one()
const sys = (name, parameters) => lib().run(name, parameters)
const rowFields = [
    'productStoreId',
    'productId',
    'fromDate',
    'thruDate',
    'publicationKindEnumId',
    'templateKey',
    'badgeText',
    'featuredRank',
    'changeReason',
    'signatureRequiredEnumId',
]
function visitor(operation, input) {
    logout()
    try {
        return lib().facade(operation, { siteId: SITE, ...input })
    } finally {
        login('john.doe')
    }
}
spec({
    dependsOn: ['ShopFixtures'],
    setupSpec() {
        login('john.doe')
    },
    cleanup() {
        login('john.doe')
    },
})

feature(
    "adopting POPC_DEFAULT's categories proposes publication rows, writing nothing, and a publisher approves them",
    {
        when() {
            const kept = list(PSP, { productStoreId: STORE }).map((row) =>
                Object.fromEntries(rowFields.map((k) => [k, row[k]])),
            )
            for (const row of kept)
                sys('delete#' + PSP, {
                    productStoreId: row.productStoreId,
                    productId: row.productId,
                    fromDate: row.fromDate,
                })
            let previewed, rowsAfterPreview, approved, rowsAfterApproval
            try {
                previewed = sys(
                    'mantle.product.StoreAdoptionServices.preview#StoreAdoption',
                    { productStoreId: STORE },
                ).preview
                rowsAfterPreview = list(PSP, { productStoreId: STORE }).length
                approved = sys(
                    'mantle.product.StoreMerchandisingServices.publish#StoreProducts',
                    {
                        productStoreId: STORE,
                        productIds: previewed.proposals
                            .slice(0, 5)
                            .map((row) => row.productId),
                        action: 'publish',
                        changeReason: 'Adoption acceptance',
                        operationKey: 'adopt-' + Date.now(),
                    },
                )
                rowsAfterApproval = list(PSP, { productStoreId: STORE }).length
            } finally {
                for (const row of list(PSP, { productStoreId: STORE }))
                    sys('delete#' + PSP, {
                        productStoreId: row.productStoreId,
                        productId: row.productId,
                        fromDate: row.fromDate,
                    })
                for (const row of kept) sys('create#' + PSP, row)
            }
            return {
                previewed,
                rowsAfterPreview,
                approved,
                rowsAfterApproval,
                restored: list(PSP, { productStoreId: STORE }).length,
                kept: kept.length,
            }
        },
        then({
            previewed,
            rowsAfterPreview,
            approved,
            rowsAfterApproval,
            restored,
            kept,
        }) {
            previewed.enabled == false
            previewed.proposals.length > 0
            rowsAfterPreview == 0
            // ZZWR_TMP's server footer: FreeMarker and server context, the theme renderer's conversion findings
            previewed.templates.roles.some(
                (row) =>
                    row.contentTypeEnumId == 'PsctFooterTemplateServer' &&
                    row.unsupported.includes('FreeMarker directives'),
            )
            previewed.templates.roles.some(
                (row) =>
                    row.contentTypeEnumId == 'PsctFooterTemplate' &&
                    row.convertible,
            )
            previewed.findings.some((row) => row.code == 'UNSUPPORTED_SYNTAX')
            previewed.categories.length > 0
            approved.doneCount == Math.min(5, previewed.proposals.length)
            rowsAfterApproval == approved.doneCount
            restored == kept
        },
    },
)

feature(
    'withdrawing the Shop mount leaves placed orders as they are, and the job places an open attempt',
    {
        when() {
            const placedBefore = list('mantle.order.OrderHeader', {
                productStoreId: STORE,
            }).filter((row) => row.statusId != 'OrderOpen')
            // a guest's checkout of Demo Product Three-One submitted to a page whose answer is lost
            const token = visitor('addCartItem', {
                productId: 'DEMO_3_1',
                quantity: '1',
            }).result.token
            visitor('beginCheckout', { token })
            visitor('setCheckoutContact', {
                token,
                emailAddress: 'withdrawn@shop-accept.example.test',
                name: 'Wendy Withdrawn',
            })
            let view = visitor('getCheckout', { token }).result
            visitor('setCheckoutAddresses', {
                token,
                expectedRevision: view.checkout.revision,
                address1: '8 Acceptance Road',
                city: 'Springfield',
                stateProvinceGeoId: 'USA_IL',
                postalCode: '62701',
                countryGeoId: 'USA',
            })
            const options = visitor('getDeliveryOptions', { token }).result
            visitor('selectDelivery', {
                token,
                expectedRevision: options.revision,
                carrierPartyId: options.options[0].carrierPartyId,
                shipmentMethodEnumId: options.options[0].shipmentMethodEnumId,
            })
            visitor('selectPayment', { token, paymentOptionId: 'PiCreditCard' })
            view = visitor('getCheckout', { token }).result
            const checkoutId = one('mantle.order.StoreCheckout', {
                returnReference: view.checkout.reference,
            })?.checkoutId
            if (checkoutId)
                sys('update#mantle.order.StoreCheckout', {
                    checkoutId,
                    paymentGatewayConfigId: 'ZIZI_SHOP_UNKNOWN',
                })
            const submitted = visitor('submitCheckout', {
                token,
                expectedRevision: view.checkout.revision,
                termsVersion: view.checkout.terms.version,
                acceptTerms: 'true',
            })
            const row = () =>
                one('mantle.order.StoreCheckout', {
                    returnReference: submitted.result.checkout.reference,
                })
            lib().setShopEnabled(SITE, false)
            let withdrawnPage, job
            try {
                withdrawnPage = visitor('getShopContext', {})
                sys('update#mantle.account.method.PaymentGatewayConfig', {
                    paymentGatewayConfigId: 'ZIZI_SHOP_UNKNOWN',
                    detailsServiceName:
                        'mantle.account.PaymentTestServices.alwaysApprove#PaymentDetails',
                })
                sys('update#mantle.account.payment.PortalPaymentAttempt', {
                    paymentId: row().paymentId,
                    nextCheckDate: null,
                })
                job = sys(
                    'mantle.order.ShopCheckoutServices.reconcile#Checkouts',
                    {
                        limit: 50,
                    },
                )
            } finally {
                sys('update#mantle.account.method.PaymentGatewayConfig', {
                    paymentGatewayConfigId: 'ZIZI_SHOP_UNKNOWN',
                    detailsServiceName:
                        'mantle.account.PaymentTestServices.alwaysPending#PaymentDetails',
                })
                lib().setShopEnabled(SITE, true)
            }
            const placedAfter = placedBefore.map((order) =>
                one('mantle.order.OrderHeader', { orderId: order.orderId }),
            )
            const checkout = row()
            const placedStatus = one('mantle.order.OrderHeader', {
                orderId: checkout.orderId,
            }).statusId
            // the scenario's order is cancelled afterwards, so its reserved stock goes back for the specs after it
            if (placedStatus != 'OrderOpen')
                sys('mantle.order.OrderServices.cancel#Order', {
                    orderId: checkout.orderId,
                })
            return {
                submitted,
                withdrawnPage,
                job,
                checkout,
                placedStatus,
                placedBefore,
                placedAfter,
            }
        },
        then({
            submitted,
            withdrawnPage,
            job,
            checkout,
            placedStatus,
            placedBefore,
            placedAfter,
        }) {
            submitted.result.checkout.attempt.state == 'unknown'
            withdrawnPage.kind == 'NotFound'
            job.failed == 0
            checkout.statusId == 'ScoCompleted'
            placedStatus != 'OrderOpen'
            placedAfter.every(
                (order, i) => order.statusId == placedBefore[i].statusId,
            )
        },
    },
)

feature(
    'a remote frontend whose authority is down serves neither the site information it kept nor a personal page',
    {
        when() {
            const transport = ec.resource.script(
                'component://mr-pass/service/pass/Transport.js',
            )
            const input = { siteId: SITE }
            const local = () => lib().facade('getSiteInfo', input).result
            const generation = () =>
                lib().facade('getSiteGeneration', input).result
            logout()
            try {
                // kept while the authority answers
                ec.cache.getCache('pass.shop.siteGenerations').remove(SITE)
                const kept = transport.readThrough(
                    'getSiteInfo',
                    input,
                    local,
                    generation,
                )
                // the authority stops answering: its generation cannot be read
                ec.cache.getCache('pass.shop.siteGenerations').remove(SITE)
                return withProperty(
                    'pass_backend_url',
                    'http://127.0.0.1:9',
                    () => {
                        const refused = (operation, extra) => {
                            try {
                                transport.call(operation, {
                                    ...input,
                                    ...extra,
                                })
                                return 'answered'
                            } catch (error) {
                                return (
                                    'refused ' +
                                    (error.moquiErrorKind || error.message)
                                )
                            }
                        }
                        return {
                            kept,
                            siteInfo: refused('getSiteInfo'),
                            account: refused('getShopAccount'),
                            cart: refused('getCart', { token: 'x'.repeat(48) }),
                        }
                    },
                )
            } finally {
                login('john.doe')
            }
        },
        then({ kept, siteInfo, account, cart }) {
            kept.site.siteId == SITE
            siteInfo.startsWith('refused')
            account.startsWith('refused')
            cart.startsWith('refused')
        },
    },
)
