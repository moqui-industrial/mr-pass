// Shop P5's "usable when" on the server (impl-shop P5; design-shop §18.1 "Price, stock, address and promotion changes",
// "Duplicate submit, crash and callbacks", "Unknown provider outcome", "Payment exception after placement"), on
// ShopFixtures' ZIZI_SHOP, each through a local page's calls and a remote frontend's (Mantle's PassAuthority, the authority
// side of both transports): a price changed during checkout asks for review and the resubmit pays the new price; a second
// submit answers the first order; an unknown outcome stays processing for a refreshed frontend (the reference and key
// only) and the reconciliation job finishes it once the provider answers; a capture that fails after placement holds the
// order, which the payment operator (PAYMENT_HOLD_RELEASE) releases. Shop P9 ("Failed placement after provider
// success"): an order changed while its payer is on the provider's page is not placed when the approved payment returns;
// the page says the order is being finished (no confirmation) and the payment stays, until the store's resolver
// (COMMERCE_PLACEMENT_RESOLVE) releases it and cancels the checkout. The browser walk is ShopCheckoutHttp.
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
function ready(call, emailAddress, productId) {
    const token = call('addCartItem', {
        productId: productId || 'DEMO_3_1',
        quantity: '1',
    }).result.token
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
feature(
    'a placement refused after the provider approved keeps its payment and confirms nothing until the resolver releases it',
    {
        when() {
            const call = caller(true)
            // (Demo Product One-One: the other scenarios use up Three-One's demo stock)
            const { token, view } = ready(
                call,
                'placement@shop-accept.example.test',
                'DEMO_1_1',
            )
            const submitted = submit(call, token, view)
            const reference = submitted.result.checkout.reference
            const key = submitted.result.returnKey
            // while the payer is on the provider's page the order changes (staff change its quantity)
            const row = rowOf(reference)
            const line = list('mantle.order.OrderItem', {
                orderId: row.orderId,
                productId: 'DEMO_1_1',
            })[0]
            sys('mantle.order.OrderServices.update#OrderItem', {
                orderId: row.orderId,
                orderItemSeqId: line.orderItemSeqId,
                quantity: 2,
            })
            // the payer comes back; the provider approved the payment, the placement is refused
            const returned = call('getCheckoutPaymentResult', {
                reference,
                key,
                returned: 'true',
            })
            const stuck = rowOf(reference)
            const stuckPayment = one('mantle.account.payment.Payment', {
                paymentId: stuck.paymentId,
            }).statusId
            const unconfirmed = call('getOrderConfirmation', {
                reference,
                key,
                token,
            })
            // the store's resolver gives the payment back and cancels the checkout (the acceptance's hosted test gateway
            // releases for this feature only)
            const T = 'mantle.account.PaymentTestServices.'
            const gateway = { paymentGatewayConfigId: 'ZIZI_SHOP_HOSTED' }
            const before = one(
                'mantle.account.method.PaymentGatewayConfig',
                gateway,
            )
            let resolved
            try {
                sys('update#mantle.account.method.PaymentGatewayConfig', {
                    ...gateway,
                    releaseServiceName: T + 'alwaysApprove#PaymentRelease',
                    refundServiceName: T + 'alwaysApprove#PaymentRefund',
                })
                resolved = sys(
                    'mantle.order.ShopOperationsServices.resolve#StuckPlacement',
                    {
                        orderId: stuck.orderId,
                        action: 'refund',
                        reason: 'Acceptance: the order changed after payment',
                        operationKey: 'accept-placement-' + Date.now(),
                    },
                )
            } finally {
                sys('update#mantle.account.method.PaymentGatewayConfig', {
                    ...gateway,
                    releaseServiceName: before.releaseServiceName || null,
                    refundServiceName: before.refundServiceName || null,
                })
            }
            return {
                returned,
                stuck,
                stuckPayment,
                unconfirmed,
                resolved,
                after: rowOf(reference),
                order: one('mantle.order.OrderHeader', {
                    orderId: stuck.orderId,
                }).statusId,
                // given back: released, or (taken already) refunded
                givenBack: list(
                    'mantle.account.method.PaymentGatewayResponse',
                    { paymentId: stuck.paymentId },
                ).filter(
                    (row) =>
                        ['PgoRelease', 'PgoRefund'].includes(
                            row.paymentOperationEnumId,
                        ) && row.resultSuccess == 'Y',
                ).length,
                page: call('getCheckoutPaymentResult', { reference, key }),
            }
        },
        then(r) {
            r.returned.result.checkout.state == 'placementPending'
            r.stuck.statusId == 'ScoPlacementPending'
            r.stuck.failureCode == 'ORDER_CHANGED'
            // the provider took the money (the hosted test page authorizes and captures)
            r.stuckPayment == 'PmntAuthorized' ||
                r.stuckPayment == 'PmntDelivered'
            !r.unconfirmed.result?.confirmation?.orderId
            r.resolved.resolved == true
            r.after.statusId == 'ScoCancelled'
            r.order == 'OrderCancelled'
            r.givenBack == 1
            r.page.result?.checkout?.state != 'completed'
        },
    },
)
