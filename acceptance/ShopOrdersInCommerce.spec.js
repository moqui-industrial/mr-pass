// Commerce P8's "usable when" (mr-boss impl-commerce P8; design-commerce §12.2 scenario 7's physical and digital half, 13
// and 14's hold half), on the Shop orders of ShopOrderScenarios (ZIZI_SHOP, POPC_DEFAULT: a mixed order with its return
// request and question, another order with its cancel request) and three more placed here through a page's calls (a
// physical order, a digital-only one and one whose capture fails after placement), with artifact authorization on as
// Commerce's store operator: the physical, digital and mixed orders show in Orders with their payment and fulfillment state
// and are the same orders in Warehouse and Accounting; the question, return request and cancel request show in Requests,
// Returns and the order's badge, each opening Customer Service, and Commerce takes none of their actions; the failed
// capture's Payment hold shows and the operator cannot release it; Order again on a past order makes a new open order at
// today's prices; and each Orders and Customers screen opens for the operator. It lives here, beside the Shop scenarios it
// reads, because a spec's dependsOn runs before it only by the order of the run (components in load order, then names); it needs mr-boss (Commerce's screens
// and demo users), and without it every feature is ignored, so PASS stands alone. The rules are Mantle's StoreOperations
// and mr-boss CommerceOrders'.
// Run: ./moq accept mr-pass --spec ShopOrdersInCommerce (with ShopFixtures and ShopOrderScenarios, its dependsOn)
const boss = ec.resource
    .getLocationReference('component://mr-boss/screen/Commerce.xml')
    .getExists()
const ignore = boss ? undefined : 'needs mr-boss (Commerce)'
const lib = boss
    ? ec.resource.script('component://mr-boss/test/Commerce/CommerceSpecLib.js')
    : { ids: {}, users: {} }
const shop = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const { ids, users, asUser, system } = lib
const O = 'mantle.order.StoreOperationsServices.'
const SITE = 'ZIZI_SHOP'
const guide = 'PASS_HTTP_PDF'
const opened = (rendered) =>
    rendered.status === 200 && rendered.errors.length === 0
const one = (entity, fields) =>
    system(() => ec.entity.find(entity).condition(fields).useCache(false).one())
const list = (entity, fields) =>
    system(() =>
        Array.from(
            ec.entity.find(entity).condition(fields).useCache(false).list(),
        ).map((row) => row.getMap()),
    )
const sys = (name, parameters) =>
    system(
        () => ec.service.sync().name(name).parameters(parameters).call() || {},
    )
const as = (user, service, parameters = {}) =>
    asUser(
        user,
        () =>
            ec.service
                .sync()
                .name(O + service)
                .parameters(parameters)
                .call() || {},
        false,
    )
// a call as the user, its refusal message or ""
const refusal = (user, service, parameters) =>
    asUser(
        user,
        () => {
            ec.message.pushErrors()
            try {
                ec.service
                    .sync()
                    .name(service)
                    .parameters(parameters)
                    .requireNewTransaction(true)
                    .call()
                return ec.message.hasError() ? ec.message.getErrorsString() : ''
            } catch (error) {
                return String(error.message)
            } finally {
                ec.message.clearErrors()
                ec.message.popErrors()
            }
        },
        false,
    )
// a page's call as a visitor
function guest(operation, input) {
    logout()
    try {
        return shop().facade(operation, Object.assign({ siteId: SITE }, input))
    } finally {
        login('john.doe')
    }
}
// a guest's checkout of the products, through the test gateway's hosted page (or the gateway given, before it is
// submitted): its StoreCheckout row
function checkout(email, productIds, gatewayConfigId) {
    let token = null
    for (const productId of productIds) {
        const added = guest(
            'addCartItem',
            Object.assign(token ? { token } : {}, { productId, quantity: '1' }),
        )
        assert(added.result, productId + ' not added: ' + JSON.stringify(added))
        token = added.result.token || token
    }
    guest('beginCheckout', { token })
    guest('setCheckoutContact', {
        token,
        emailAddress: email,
        name: 'Olive Operator',
    })
    const begun = guest('getCheckout', { token }).result
    if (begun.checkout.addresses.needed) {
        guest('setCheckoutAddresses', {
            token,
            expectedRevision: begun.checkout.revision,
            address1: '8 Commerce Walk',
            city: 'Springfield',
            stateProvinceGeoId: 'USA_IL',
            postalCode: '62701',
            countryGeoId: 'USA',
        })
        const options = guest('getDeliveryOptions', { token }).result
        guest('selectDelivery', {
            token,
            expectedRevision: options.revision,
            carrierPartyId: options.options[0].carrierPartyId,
            shipmentMethodEnumId: options.options[0].shipmentMethodEnumId,
        })
    }
    guest('selectPayment', { token, paymentOptionId: 'PiCreditCard' })
    const view = guest('getCheckout', { token }).result
    if (gatewayConfigId) {
        const row = one('mantle.order.StoreCheckout', {
            returnReference: view.checkout.reference,
        })
        sys('update#mantle.order.StoreCheckout', {
            checkoutId: row.checkoutId,
            paymentGatewayConfigId: gatewayConfigId,
        })
    }
    const submitted = guest('submitCheckout', {
        token,
        expectedRevision: view.checkout.revision,
        termsVersion: view.checkout.terms.version,
        acceptTerms: 'true',
    })
    assert(submitted.result, 'not submitted: ' + JSON.stringify(submitted))
    // the provider's return: the attempt looked up again now, as the result page does (ShopOrderScenarios' buy)
    const row = one('mantle.order.StoreCheckout', {
        returnReference: submitted.result.checkout.reference,
    })
    if (row.paymentId)
        sys('update#mantle.account.payment.PortalPaymentAttempt', {
            paymentId: row.paymentId,
            lastCheckDate: null,
        })
    guest('getCheckoutPaymentResult', {
        reference: submitted.result.checkout.reference,
        key: submitted.result.returnKey,
    })
    return one('mantle.order.StoreCheckout', {
        returnReference: submitted.result.checkout.reference,
    })
}
// a transition posted as the user, as its form submits it
function post(user, path, parameters) {
    return asUser(user, () => {
        const result = ec.screen
            .makeTest()
            .rootScreen('component://mr-boss/screen/Commerce.xml')
            .render(path, parameters, 'post')
        const errors = Array.from(result.errorMessages || [])
        ec.message.clearErrors()
        return {
            status: result.status,
            errors,
            output: String(result.output || ''),
        }
    })
}
// an order in another app's OrderDetail as the system administrator, rendered once
function inApp(root, path, orderId) {
    return system(() => {
        const result = ec.screen
            .makeTest()
            .rootScreen('component://mr-boss/screen/' + root + '.xml')
            .renderMode('qvt')
            .withStaticData()
            .render(path, { orderId, lastStandalone: '-2' }, null)
        ec.message.clearErrors()
        return { status: result.status, output: String(result.output || '') }
    })
}
// the payment states a placed physical order may be in before it ships
const paymentStates = ['Paid', 'Authorized', 'Promised', 'Unpaid']
const walk = {}

spec({
    stepwise: true,
    dependsOn: ['ShopFixtures', 'ShopOrderScenarios'],
    setupSpec() {
        login('john.doe')
        if (!boss) return
        // ShopOrderScenarios' two orders of the same guest: the mixed one (a physical and a digital line) and the other
        // (physical, with its cancel request)
        const placed = list('mantle.order.StoreCheckout', {
            contactEmail: 'petra@accept.example.test',
            statusId: 'ScoCompleted',
        })
        walk.mixed = placed.find(
            (row) =>
                list('mantle.order.OrderItem', {
                    orderId: row.orderId,
                    productId: guide,
                }).length,
        )?.orderId
        walk.other = placed.find((row) => row.orderId !== walk.mixed)?.orderId
        assert(
            walk.mixed && walk.other,
            "ShopOrderScenarios' orders are missing: " + JSON.stringify(placed),
        )
    },
    cleanupSpec() {
        ec.message.clearErrors()
        login('john.doe')
        ec.artifactExecution.enableAuthz()
    },
})

feature(
    'the physical, digital and mixed Shop orders show in Orders with their payment and fulfillment, and in Warehouse and Accounting',
    {
        ignore,
        when() {
            const physical = checkout(
                'olive.physical@commerce-accept.example.test',
                ['DEMO_3_1'],
            )
            const digital = checkout(
                'olive.digital@commerce-accept.example.test',
                [guide],
            )
            walk.physical = physical.orderId
            walk.digital = digital.orderId
            // the store's staff approve them (POPC_DEFAULT holds a new customer's first order, impl-shop F86); the digital
            // line is then captured, invoiced and granted
            for (const orderId of [walk.physical, walk.digital])
                if (
                    one('mantle.order.OrderHeader', { orderId }).statusId ===
                    'OrderPlaced'
                )
                    sys('mantle.order.OrderServices.approve#Order', { orderId })
            assert(
                ec.factory.waitWorkerPoolEmpty(100),
                'the fulfillment did not finish',
            )
            const rows =
                as(users.operator, 'find#StoreOrders', {
                    productStoreId: ids.storeId,
                    pageSize: 100,
                }).orders || []
            const row = (orderId) =>
                rows.find((order) => order.orderId === orderId) || {}
            return {
                physical: row(walk.physical),
                digital: row(walk.digital),
                mixed: row(walk.mixed),
                open: rows.some((order) => order.statusId === 'OrderOpen'),
                warehouse: inApp('Warehouse', 'Orders/OrderDetail', walk.mixed),
                accounting: inApp(
                    'Accounting',
                    'Records/OrderDetail',
                    walk.mixed,
                ),
                invoices: list('mantle.order.OrderItemBilling', {
                    orderId: walk.mixed,
                }).length,
            }
        },
        then(r) {
            r.physical.orderId == walk.physical
            r.physical.storeName == 'Ziziwork Retail Store'
            paymentStates.includes(r.physical.paymentText)
            r.physical.fulfillmentText == 'Not shipped'
            r.digital.fulfillmentText == 'Downloads ready'
            r.digital.paymentText == 'Paid'
            // its physical part shipped; ShopOrderScenarios refunded its digital line, so the download is revoked
            r.mixed.fulfillmentText == 'Shipped · Downloads revoked'
            r.open == false
            r.warehouse.status == 200
            r.warehouse.output.includes(walk.mixed)
            r.accounting.status == 200
            r.accounting.output.includes(walk.mixed)
            r.invoices > 0
        },
    },
)

feature(
    "the customer's question, return request and cancel request show in Requests, Returns and the order's badge, worked in Customer Service",
    {
        ignore,
        when() {
            const requests =
                as(users.operator, 'find#StoreRequests', {
                    productStoreId: ids.storeId,
                    pageSize: 100,
                }).requests || []
            const returns =
                as(users.operator, 'find#StoreReturns', {
                    productStoreId: ids.storeId,
                    pageSize: 100,
                }).returns || []
            const asked = requests.find((row) => row.orderId === walk.mixed)
            const returned = returns.find((row) => row.orderId === walk.mixed)
            const cancelRequests =
                as(users.operator, 'find#StoreOrders', {
                    attention: 'cancelRequest',
                    pageSize: 100,
                }).orders || []
            const otherStatus = one('mantle.order.OrderHeader', {
                orderId: walk.other,
            }).statusId
            walk.requestId = asked?.requestId
            walk.returnId = returned?.returnId
            return {
                asked,
                returned,
                cancelBadge: cancelRequests.some(
                    (row) => row.orderId === walk.other,
                ),
                otherStatus,
                // the owners' screens: the system administrator opens Customer Service from each; the operator has no link
                adminLinks: system(
                    () =>
                        ec.service
                            .sync()
                            .name(
                                'ironstone.commerce.ContextServices.get#OperationLinks',
                            )
                            .call().links,
                ),
                operatorLinks: asUser(users.operator, () =>
                    ec.service
                        .sync()
                        .name(
                            'ironstone.commerce.ContextServices.get#OperationLinks',
                        )
                        .call(),
                ).links,
                requestPage: asUser(users.operator, () =>
                    lib.page('Customers/RequestDetail', {
                        requestId: walk.requestId,
                    }),
                ),
                returnPage: asUser(users.operator, () =>
                    lib.page('Orders/ReturnDetail', {
                        returnId: walk.returnId,
                    }),
                ),
                otherPage: asUser(users.operator, () =>
                    lib.page('Orders/OrderDetail', { orderId: walk.other }),
                ),
                // Commerce takes none of their actions: the operator cannot authorize the return or decide the change
                authorize: refusal(
                    users.operator,
                    'mantle.order.ReturnPolicyServices.authorize#Return',
                    {
                        returnId: walk.returnId,
                    },
                ),
            }
        },
        then(r) {
            r.asked != null
            r.asked.open == true
            r.returned != null
            r.returned.statusId == 'ReturnRequested'
            r.cancelBadge || r.otherStatus == 'OrderCancelled'
            r.adminLinks.caseDetail ==
                '/qapps/CustomerService/Cases/CaseDetail?requestId='
            r.adminLinks.serviceReturn ==
                '/qapps/CustomerService/Returns/ReturnDetail?returnId='
            r.adminLinks.orderChange ==
                '/qapps/CustomerService/Orders/OrderChangeDetail?requestId='
            r.operatorLinks.caseDetail == null
            opened(r.requestPage)
            r.requestPage.output.includes('About my e-guide')
            r.requestPage.output.includes('Internal note')
            opened(r.returnPage)
            r.returnPage.output.includes(
                'Customer Service authorizes the return and Accounting settles it',
            )
            opened(r.otherPage)
            r.cancelBadge == false ||
                r.otherPage.output.includes('Cancellation requested')
            r.authorize != ''
        },
    },
)

feature(
    'a capture that fails after placement shows the Payment hold, which the Commerce operator cannot release',
    {
        ignore,
        when() {
            const row = checkout(
                'olive.capture@commerce-accept.example.test',
                ['DEMO_3_1'],
                'ZIZI_SHOP_CAPFAIL',
            )
            walk.held = row.orderId
            // the capture (at shipping or invoicing) is declined
            system(() => {
                ec.message.pushErrors()
                try {
                    ec.service
                        .sync()
                        .name(
                            'mantle.account.PaymentServices.capture#SinglePayment',
                        )
                        .parameters({ paymentId: row.paymentId })
                        .call()
                } finally {
                    ec.message.clearErrors()
                    ec.message.popErrors()
                }
            })
            const reason = list('mantle.order.OrderHoldReason', {
                orderId: walk.held,
            }).find(
                (hold) =>
                    hold.holdTypeEnumId === 'OhtPayment' && !hold.releasedDate,
            )
            return {
                reason,
                held: (
                    as(users.operator, 'find#StoreOrders', {
                        attention: 'paymentHold',
                        pageSize: 100,
                    }).orders || []
                ).find((order) => order.orderId === walk.held),
                page: asUser(users.operator, () =>
                    lib.page('Orders/OrderDetail', { orderId: walk.held }),
                ),
                release: refusal(
                    users.operator,
                    'mantle.order.OrderServices.release#OrderHold',
                    {
                        orderHoldReasonId: reason?.orderHoldReasonId,
                        releaseComment: 'From Commerce',
                    },
                ),
                stillHeld: one('mantle.order.OrderHeader', {
                    orderId: walk.held,
                }).statusId,
            }
        },
        then(r) {
            r.reason != null
            r.held.paymentHold == true
            r.held.paymentText == 'Payment hold'
            opened(r.page)
            r.page.output.includes(
                'an Accounting payment operator releases the hold',
            )
            r.release.includes('PAYMENT_HOLD_RELEASE')
            r.stillHeld == 'OrderHold'
        },
    },
)

feature(
    "Order again on a past order makes a new open order at today's prices, with no payment",
    {
        ignore,
        when() {
            const before = list('mantle.order.OrderHeader', {
                parentOrderId: walk.physical,
            }).map((row) => row.orderId)
            const posted = post(
                users.operator,
                'Orders/OrderDetail/commerceReorder',
                { orderId: walk.physical },
            )
            const made = list('mantle.order.OrderHeader', {
                parentOrderId: walk.physical,
            }).find((row) => !before.includes(row.orderId))
            const item = made
                ? list('mantle.order.OrderItem', {
                      orderId: made.orderId,
                  }).find((row) => row.productId === 'DEMO_3_1')
                : null
            const price = sys('mantle.product.PriceServices.get#ProductPrice', {
                productId: 'DEMO_3_1',
                productStoreId: ids.storeId,
                quantity: 1,
                priceUomId: 'USD',
            })
            return {
                posted,
                made,
                item,
                price,
                payments: made
                    ? list('mantle.account.payment.Payment', {
                          orderId: made.orderId,
                      })
                    : [],
                cart: made
                    ? asUser(users.operator, () =>
                          lib.page('Orders/CartDetail', {
                              orderId: made.orderId,
                          }),
                      )
                    : null,
            }
        },
        then(r) {
            r.posted.errors == []
            r.made.statusId == 'OrderOpen'
            r.made.productStoreId == ids.storeId
            Number(String(r.item.unitAmount)) == Number(String(r.price.price))
            r.payments == []
            opened(r.cart)
            r.cart.output.includes('Made by staff')
        },
    },
)

feature('each Orders and Customers screen opens for the operator', {
    ignore,
    when() {
        const customerPartyId = one('mantle.order.OrderPart', {
            orderId: walk.mixed,
            orderPartSeqId: '01',
        }).customerPartyId
        return asUser(users.operator, () => ({
            home: lib.page('Home'),
            orders: lib.page('Orders/Orders'),
            carts: lib.page('Orders/Carts'),
            returns: lib.page('Orders/Returns'),
            customers: lib.page('Customers/Customers'),
            requests: lib.page('Customers/Requests'),
            customer: lib.page('Customers/Customer360', { customerPartyId }),
            html: lib.page('Orders/Orders', {}, 'html'),
        }))
    },
    then(r) {
        Object.values(r).every(opened)
        r.home.output.includes('Recent orders')
        r.orders.output.includes(walk.held)
        r.returns.output.includes('Requested')
        r.customer.output.includes('Payment methods')
        !r.customer.output.includes('Choose an organization')
        r.html.output.includes(walk.mixed)
    },
})
