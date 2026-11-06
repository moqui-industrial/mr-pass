// Shop P5's "usable when" on the server (impl-shop P5; design-shop §18.1 "Price, stock, address and promotion changes",
// "Duplicate submit, crash and callbacks", "Unknown provider outcome", "Payment exception after placement"), on
// ShopFixtures' ZIZI_SHOP, each through a local page's calls and a remote frontend's (Mantle's PassAuthority, the authority
// side of both transports): a price changed during checkout asks for review and the resubmit pays the new price; a second
// submit answers the first order; an unknown outcome stays processing for a refreshed frontend (the reference and key
// only) and the reconciliation job finishes it once the provider answers; a capture that fails after placement holds the
// order, which the payment operator (PAYMENT_HOLD_RELEASE) releases. The browser walk is ShopCheckoutHttp.
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const SITE = 'ZIZI_SHOP'
const one = (entity, fields) =>
    ec.entity.find(entity).condition(fields).disableAuthz().one()
const list = (entity, fields) =>
    Array.from(ec.entity.find(entity).condition(fields).disableAuthz().list())
const sys = (name, parameters) => lib().run(name, parameters)
// a frontend's call as a visitor: local (the facade) or remote (the authority's answer through Transport.js)
function caller(remote) {
    return (operation, input) => {
        logout()
        try {
            return remote
                ? lib().remote(operation, { siteId: SITE, ...input })
                : lib().facade(operation, { siteId: SITE, ...input })
        } finally {
            login('john.doe')
        }
    }
}
// a guest's cart of Demo Product Three-One (POPC_DEFAULT requires inventory, which the demo's physical items have), its
// delivery address and the first delivery option, ready to pay
function ready(call, emailAddress) {
    const token = call('addCartItem', { productId: 'DEMO_3_1', quantity: '1' })
        .result.token
    call('beginCheckout', { token })
    call('setCheckoutContact', { token, emailAddress, name: 'Accept Guest' })
    const begun = call('getCheckout', { token }).result
    call('setCheckoutAddresses', {
        token,
        expectedRevision: begun.checkout.revision,
        address1: '7 Acceptance Road',
        city: 'Springfield',
        stateProvinceGeoId: 'USA_IL',
        postalCode: '62701',
        countryGeoId: 'USA',
    })
    const options = call('getDeliveryOptions', { token }).result
    call('selectDelivery', {
        token,
        expectedRevision: options.revision,
        carrierPartyId: options.options[0].carrierPartyId,
        shipmentMethodEnumId: options.options[0].shipmentMethodEnumId,
    })
    call('selectPayment', { token, paymentOptionId: 'PiCreditCard' })
    return { token, view: call('getCheckout', { token }).result }
}
const submit = (call, token, view, extra) =>
    call('submitCheckout', {
        token,
        expectedRevision: view.checkout.revision,
        termsVersion: view.checkout.terms.version,
        acceptTerms: 'true',
        ...(extra || {}),
    })
const rowOf = (reference) =>
    one('mantle.order.StoreCheckout', { returnReference: reference })
spec({
    dependsOn: ['ShopFixtures'],
    setupSpec() {
        login('john.doe')
        setProperty(
            'pass_client_' + lib().ids.client + '_secret',
            'pass-shop-spec-secret',
        )
        setProperty('pass_client_' + lib().ids.client + '_sites', SITE)
    },
    cleanup() {
        login('john.doe')
    },
})
feature(
    'a price changed during checkout asks for review; a second submit answers the first order (local and remote)',
    {
        where: [{ remote: false }, { remote: true }],
        when({ remote }) {
            const call = caller(remote)
            const { token, view } = ready(
                call,
                (remote ? 'remote' : 'local') +
                    '.price@shop-accept.example.test',
            )
            // the store's price of the item rises while the guest checks out (a newer row of the store's), and ends after
            const before = view.checkout.lines[0].unitPrice.amount
            const price = sys('create#mantle.product.ProductPrice', {
                productId: 'DEMO_3_1',
                productStoreId: 'POPC_DEFAULT',
                pricePurposeEnumId: 'PppPurchase',
                priceTypeEnumId: 'PptCurrent',
                fromDate: ec.user.nowTimestamp,
                minQuantity: 1,
                price: '99.00',
                priceUomId: 'USD',
            })
            let changed, reviewed, first, second, payments
            try {
                changed = submit(call, token, view)
                reviewed = call('getCheckout', { token })
                first = submit(call, token, reviewed.result, {
                    operationId: 'accept-price-' + remote + '-' + Date.now(),
                })
                second = submit(call, token, reviewed.result, {
                    operationId: 'accept-price-2-' + remote + '-' + Date.now(),
                })
                payments = list('mantle.account.payment.Payment', {
                    orderId: rowOf(first.result.checkout.reference).orderId,
                })
            } finally {
                sys('update#mantle.product.ProductPrice', {
                    productPriceId: price.productPriceId,
                    thruDate: ec.user.nowTimestamp,
                })
            }
            return { view, before, changed, reviewed, first, second, payments }
        },
        then({ view, before, changed, reviewed, first, second, payments }) {
            view.checkout.terms.required == true
            view.checkout.state == 'ready'
            before != '99.00'
            changed.kind == 'Conflict'
            changed.reason == 'reviewRequired'
            reviewed.result.checkout.review.some(
                (change) => change.kind == 'price',
            )
            reviewed.result.checkout.lines[0].unitPrice.amount == '99.00'
            first.result.checkout.state == 'paymentPending'
            second.result.alreadySubmitted == true
            second.result.checkout.reference == first.result.checkout.reference
            payments.length == 1
            toDecimal(payments[0].amount).compare(toDecimal('99.00')) >= 0
        },
    },
)
feature(
    'an unknown outcome stays processing for a refreshed frontend and is reconciled once the provider answers',
    {
        where: [{ remote: false }, { remote: true }],
        when({ remote }) {
            const call = caller(remote)
            const { token, view } = ready(
                call,
                (remote ? 'remote' : 'local') +
                    '.unknown@shop-accept.example.test',
            )
            // the provider's answer to this checkout's payment is lost
            sys('update#mantle.order.StoreCheckout', {
                checkoutId: rowOf(view.checkout.reference).checkoutId,
                paymentGatewayConfigId: 'ZIZI_SHOP_UNKNOWN',
            })
            const submitted = submit(call, token, view)
            const reference = submitted.result.checkout.reference
            const key = submitted.result.returnKey
            // a refreshed frontend: no cart capability, only the reference and key
            const processing = call('getCheckoutPaymentResult', {
                reference,
                key,
                returned: 'true',
            })
            // the provider answers its lookup now; the job (each attempt in its own transactions) finishes the checkout
            sys('update#mantle.account.method.PaymentGatewayConfig', {
                paymentGatewayConfigId: 'ZIZI_SHOP_UNKNOWN',
                detailsServiceName:
                    'mantle.account.PaymentTestServices.alwaysApprove#PaymentDetails',
            })
            let job
            try {
                sys('update#mantle.account.payment.PortalPaymentAttempt', {
                    paymentId: rowOf(reference).paymentId,
                    nextCheckDate: null,
                })
                job = sys(
                    'mantle.order.ShopCheckoutServices.reconcile#Checkouts',
                    { limit: 50 },
                )
            } finally {
                sys('update#mantle.account.method.PaymentGatewayConfig', {
                    paymentGatewayConfigId: 'ZIZI_SHOP_UNKNOWN',
                    detailsServiceName:
                        'mantle.account.PaymentTestServices.alwaysPending#PaymentDetails',
                })
            }
            const responses = list(
                'mantle.account.method.PaymentGatewayResponse',
                { paymentId: rowOf(reference).paymentId },
            )
            return {
                processing,
                job,
                // Shop P6 (F85): the reference and key read only the order's state; the cart's own session the confirmation
                confirmation: call('getOrderConfirmation', {
                    reference,
                    key,
                    token,
                }),
                responses,
            }
        },
        then({ processing, job, confirmation, responses }) {
            processing.result.checkout.state == 'paymentPending'
            processing.result.checkout.attempt.state == 'unknown'
            job.failed == 0
            confirmation.result.confirmation.payment.state == 'authorized'
            responses.filter((r) => r.paymentOperationEnumId == 'PgoAuthorize')
                .length == 1
        },
    },
)
feature(
    'a capture that fails after placement holds the order; the payment operator releases it',
    {
        when() {
            const call = caller(true)
            const { token, view } = ready(
                call,
                'capture@shop-accept.example.test',
            )
            sys('update#mantle.order.StoreCheckout', {
                checkoutId: rowOf(view.checkout.reference).checkoutId,
                paymentGatewayConfigId: 'ZIZI_SHOP_CAPFAIL',
            })
            const submitted = submit(call, token, view)
            const row = rowOf(submitted.result.checkout.reference)
            const placed = one('mantle.order.OrderHeader', {
                orderId: row.orderId,
            }).statusId
            // the capture (at shipping or invoicing) is declined
            sys('mantle.account.PaymentServices.capture#SinglePayment', {
                paymentId: row.paymentId,
            })
            const reasons = list('mantle.order.OrderHoldReason', {
                orderId: row.orderId,
            }).filter((r) => r.holdTypeEnumId == 'OhtPayment')
            const held = one('mantle.order.OrderHeader', {
                orderId: row.orderId,
            }).statusId
            sys('mantle.order.OrderServices.release#OrderHold', {
                orderHoldReasonId: reasons[0]?.orderHoldReasonId,
                releaseComment: 'Card replaced; captured again',
            })
            return {
                submitted,
                placed,
                reasons,
                held,
                released: one('mantle.order.OrderHeader', {
                    orderId: row.orderId,
                }).statusId,
            }
        },
        then({ submitted, placed, reasons, held, released }) {
            submitted.result.checkout.state == 'completed'
            placed != 'OrderOpen'
            reasons.length == 1
            held == 'OrderHold'
            released != 'OrderHold'
        },
    },
)
