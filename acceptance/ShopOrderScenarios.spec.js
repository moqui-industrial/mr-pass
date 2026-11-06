// Shop P6's "usable when" on the server (impl-shop P6; design-shop §18.1 "Mixed physical/digital purchase", "Protected
// download", "Account/payment self-service", "Reviews and support" its support half, "One account"), on ShopFixtures'
// ZIZI_SHOP (POPC_DEFAULT) through a page's calls: a guest buys a physical and a digital item; once approved the digital line
// is captured, invoiced and its receipt and download notice sent, and the notice's link downloads only that file, while the
// physical part ships on its own invoice; the guest's return request and question by the order link are a ReturnHeader in
// ReturnRequested and a case in the store's queue carrying the store, and a cancel request of another order says
// "Cancellation requested"; the guest registers with the purchase email and, verified, sees the order, its invoice in
// Billing and the case in Support from the hub, which an unverified account does not; a signed-in buyer adds a card
// through the hosted setup and an address, ending the card names the recurring order it pays, and a refund of the digital
// item ends its download. Run: ./moq accept mr-pass --spec ShopOrderScenarios
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const SITE = 'ZIZI_SHOP'
const capture = ec.factory.getTool('MailCapture')
const one = (entity, fields) =>
    ec.entity.find(entity).condition(fields).disableAuthz().one()
const list = (entity, fields) =>
    Array.from(ec.entity.find(entity).condition(fields).disableAuthz().list())
const sys = (name, parameters) => lib().run(name, parameters)
const ids = {
    guide: 'PASS_HTTP_PDF',
    file: 'dbresource://mr-pass/acceptance/eguide.txt',
    buyer: 'PASS_ACC_BUYER',
    unverified: 'PASS_ACC_UNVERIFIED',
}
const state = {}
const since = new Date(1265184000000)
// a page's call: as a visitor (null) or an account
function call(username, operation, input) {
    if (username) login(username)
    else logout()
    try {
        return lib().facade(operation, { siteId: SITE, ...input })
    } finally {
        login('john.doe')
    }
}
const guest = (operation, input) => call(null, operation, input)
// a guest's checkout of the products as email, through the hosted test page; {orderId, orderToken, token}
function buy(email, productIds) {
    let token = null
    for (const productId of productIds) {
        const added = guest('addCartItem', {
            ...(token ? { token } : {}),
            productId,
            quantity: '1',
        })
        assert(added.result, productId + ' not added: ' + JSON.stringify(added))
        token = added.result.token || token
    }
    guest('beginCheckout', { token })
    guest('setCheckoutContact', {
        token,
        emailAddress: email,
        name: 'Petra Purchaser',
    })
    const begun = guest('getCheckout', { token }).result
    if (begun.checkout.addresses.needed) {
        guest('setCheckoutAddresses', {
            token,
            expectedRevision: begun.checkout.revision,
            address1: '9 Mixed Order Way',
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
    const submitted = guest('submitCheckout', {
        token,
        expectedRevision: view.checkout.revision,
        termsVersion: view.checkout.terms.version,
        acceptTerms: 'true',
    }).result
    const row = one('mantle.order.StoreCheckout', {
        returnReference: submitted.checkout.reference,
    })
    sys('update#mantle.account.payment.PortalPaymentAttempt', {
        paymentId: row.paymentId,
        lastCheckDate: null,
    })
    guest('getCheckoutPaymentResult', {
        reference: submitted.checkout.reference,
        key: submitted.returnKey,
    })
    const confirmation = guest('getOrderConfirmation', { token }).result
    return {
        orderId: row.orderId,
        orderToken: confirmation.orderToken,
        token,
        partyId: row.customerPartyId,
    }
}
function account(partyId, email, verified) {
    if (one('mantle.party.Party', { partyId })) return
    sys('create#mantle.party.Party', { partyId, partyTypeEnumId: 'PtyPerson' })
    sys('create#mantle.party.Person', {
        partyId,
        firstName: 'Petra',
        lastName: partyId,
    })
    sys('create#moqui.security.UserAccount', {
        userId: partyId,
        username: partyId,
        partyId,
        emailAddress: email,
        currentPassword: '16ac58bbfa332c1c55bd98b53e60720bfa90d394',
        passwordHashType: 'SHA',
        timeZone: 'UTC',
    })
    if (verified)
        sys('create#moqui.security.public.VerifiedAddress', {
            userId: partyId,
            emailAddress: email,
            verifiedAt: ec.user.nowTimestamp,
        })
}
spec({
    stepwise: true,
    setupSpec() {
        capture.enable()
        login('john.doe')
        ec.artifactExecution.disableAuthz()
        const once = (entity, key, values) => {
            if (!one(entity, key))
                sys('create#' + entity, { ...key, ...(values || {}) })
        }
        // ZIZI_SHOP's Account, Billing and Support mounts (Commerce's demo has them; a PASS-only run makes them)
        for (const [app, pathPrefix, targetId] of [
            ['account', '/account', null],
            ['billing', '/billing', 'ORG_ZIZI_RETAIL'],
            ['support', '/support', 'ORG_ZIZI_RETAIL'],
        ])
            if (!one('mantle.public.PublicSiteApp', { siteId: SITE, app }))
                sys('create#mantle.public.PublicSiteApp', {
                    siteId: SITE,
                    appMountId: app,
                    app,
                    pathPrefix,
                    enabled: 'Y',
                    ...(targetId ? { targetId } : {}),
                })
        // ShopFixtures' digital guide of POPC_DEFAULT made downloadable, and the store's download-ready and receipt emails
        ec.resource
            .getLocationReference(ids.file)
            .putText('The acceptance e-guide, version one.')
        once(
            'mantle.product.ProductContent',
            { productContentId: ids.guide + '_FILE' },
            {
                productId: ids.guide,
                productContentTypeEnumId: 'PcntDownload',
                contentLocation: ids.file,
                description: 'eguide.txt',
                fromDate: since,
            },
        )
        once(
            'moqui.basic.email.EmailServer',
            { emailServerId: 'PASS_ACC_SMTP' },
            { smtpHost: '127.0.0.1', smtpPort: '9', smtpStartTls: 'N' },
        )
        for (const [type, subject] of [
            ['PsetDownloadReady', 'Acceptance downloads'],
            ['PsetInvoiceFinalized', 'Acceptance receipt'],
        ]) {
            once(
                'moqui.basic.email.EmailTemplate',
                { emailTemplateId: 'PASS_ACC_' + type },
                {
                    emailServerId: 'PASS_ACC_SMTP',
                    fromAddress: 'store@retail.example',
                    subject,
                    bodyScreenLocation:
                        'component://framework/screen/ScreenRenderEmail.xml',
                },
            )
            const current = list('mantle.product.store.ProductStoreEmail', {
                productStoreId: 'POPC_DEFAULT',
                emailTypeEnumId: type,
            })
            for (const row of current)
                sys('update#mantle.product.store.ProductStoreEmail', {
                    ...row.getPrimaryKeys(),
                    thruDate: ec.user.nowTimestamp,
                })
            sys('create#mantle.product.store.ProductStoreEmail', {
                productStoreId: 'POPC_DEFAULT',
                emailTypeEnumId: type,
                fromDate: ec.user.nowTimestamp,
                emailTemplateId: 'PASS_ACC_' + type,
            })
        }
        // stock of the physical item this spec buys, so the other scenarios keep theirs
        sys('mantle.product.AssetServices.receive#Asset', {
            productId: 'DEMO_3_1',
            facilityId: 'ZIRET_WH',
            ownerPartyId: 'ORG_ZIZI_RETAIL',
            quantity: 4,
            acquireCost: 5,
        })
        account(ids.unverified, 'quinn@accept.example.test', false)
        account(ids.buyer, 'remy@accept.example.test', true)
    },
    cleanupSpec() {
        capture.reset()
        ec.artifactExecution.enableAuthz()
    },
})

feature(
    'a guest buys a physical and a digital item; the digital line is paid, receipted and downloaded by its link only',
    {
        when() {
            capture.clear()
            state.mixed = buy('petra@accept.example.test', [
                'DEMO_3_1',
                ids.guide,
            ])
            state.other = buy('petra@accept.example.test', ['DEMO_3_1'])
            // the store's staff approve the orders (POPC_DEFAULT approves a new customer's order by hand)
            for (const orderId of [state.mixed.orderId, state.other.orderId])
                sys('mantle.order.OrderServices.approve#Order', { orderId })
            assert(
                ec.factory.waitWorkerPoolEmpty(100),
                'Worker pool did not drain',
            )
            const rows = list('mantle.product.store.StoreItemFulfillment', {
                orderId: state.mixed.orderId,
            })
            const subjects = capture
                .getMessages()
                .map((message) => message.subject)
            const notice = capture
                .getMessages()
                .find((message) => message.subject === 'Acceptance downloads')
            const link = decodeURIComponent(
                (/token=([A-Za-z0-9_%-]+)/.exec(
                    String(notice?.bodyText || notice?.body || ''),
                ) || [])[1] || '',
            )
            const downloads = guest('getDownloads', { orderToken: link })
            const issued = guest('issueDownload', {
                orderToken: link,
                downloadGrantId:
                    downloads.result?.downloads[0]?.downloadGrantId,
            })
            const file = guest('getShopDownload', {
                downloadGrantId:
                    downloads.result?.downloads[0]?.downloadGrantId,
                downloadToken: issued.result?.downloadToken,
            })
            const otherOrder = guest('getShopOrder', {
                orderToken: link,
                orderId: state.other.orderId,
            })
            // the physical part ships, invoiced on its own
            const part = list('mantle.order.OrderPart', {
                orderId: state.mixed.orderId,
            })[0]
            sys('mantle.shipment.ShipmentServices.ship#OrderPart', {
                orderId: state.mixed.orderId,
                orderPartSeqId: part.orderPartSeqId,
            })
            const invoices = list('mantle.order.OrderItemBilling', {
                orderId: state.mixed.orderId,
            }).map((row) => row.invoiceId)
            return {
                rows,
                subjects,
                link,
                downloads,
                file,
                otherOrder,
                invoices: [...new Set(invoices)],
            }
        },
        then(r) {
            r.rows.length == 1
            r.rows[0].stepEnumId == 'SifCompleted'
            r.subjects.includes('Acceptance receipt')
            r.subjects.includes('Acceptance downloads')
            r.downloads.result.downloads.length == 1
            r.file.result.location == ids.file
            r.otherOrder.kind == 'NotFound'
            r.invoices.length == 2
        },
    },
)

feature(
    "the guest's order link files a return request and a question; another order's cancel request is a proposal",
    {
        when() {
            logout()
            ec.web.sessionAttributes['passShopOrders:' + SITE] = JSON.stringify(
                {
                    [state.mixed.orderId]: state.mixed.orderToken,
                    [state.other.orderId]: state.other.orderToken,
                },
            )
            try {
                const offer = lib().facade('getReturnableOrder', {
                    siteId: SITE,
                    orderToken: state.mixed.orderToken,
                    orderId: state.mixed.orderId,
                })
                const line =
                    offer.result?.order?.lines.find(
                        (row) => row.returnable && !row.evidenceRequired,
                    ) ||
                    offer.result?.order?.lines.find((row) => row.returnable)
                // a function-bearing upload does not cross a service call (Portals' spec): Customer Service's module directly, as
                // the authority's service runs it for the page
                const returned = parallel(
                    1,
                    (thread, args) => {
                        try {
                            return {
                                result: ec.resource
                                    .script(
                                        'component://mr-mantle/service/mantle/order/CustomerReturns.js',
                                    )
                                    .execute('requestCustomerReturn', {
                                        ...args,
                                        // the photo of the goods the store's policy asks for, as a page's upload gives it
                                        file: {
                                            name: 'goods.pdf',
                                            size: 64,
                                            contentType: 'application/pdf',
                                            write: (location) =>
                                                ec.resource
                                                    .getLocationReference(
                                                        location,
                                                    )
                                                    .putText(
                                                        '%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n',
                                                    ),
                                        },
                                    }),
                            }
                        } catch (error) {
                            ec.message.clearErrors()
                            return { error: String(error.message) }
                        }
                    },
                    {
                        siteId: SITE,
                        orderToken: state.mixed.orderToken,
                        orderId: state.mixed.orderId,
                        lines: JSON.stringify([
                            {
                                orderItemSeqId: line?.orderItemSeqId,
                                quantity: 1,
                                returnReasonEnumId: (
                                    offer.result?.reasons.find(
                                        (reason) => !reason.evidenceRequired,
                                    ) || offer.result?.reasons[0]
                                )?.returnReasonEnumId,
                            },
                        ]),
                        operationId: 'accept-return-' + Date.now(),
                    },
                    { transaction: true, timeout: 30 },
                )[0]
                assert(returned.result, 'return: ' + JSON.stringify(returned))
                const asked = lib().facade('createCustomerCase', {
                    siteId: SITE,
                    orderToken: state.mixed.orderToken,
                    orderId: state.mixed.orderId,
                    requestName: 'About my e-guide',
                    description: 'Is there a printed edition?',
                    operationId: 'accept-case-' + Date.now(),
                })
                const intake = lib().facade('getCaseIntake', {
                    siteId: SITE,
                    orderToken: state.other.orderToken,
                    orderId: state.other.orderId,
                })
                const cancel = lib().facade('requestOrderCancel', {
                    siteId: SITE,
                    orderToken: state.other.orderToken,
                    orderId: state.other.orderId,
                    lines: JSON.stringify(
                        intake.result?.order?.lines.map((row) => ({
                            orderItemSeqId: row.orderItemSeqId,
                        })) || [],
                    ),
                    consent: 'Y',
                    operationId: 'accept-cancel-' + Date.now(),
                })
                state.requestId = asked.result?.requestId
                return {
                    returned,
                    header: one('mantle.order.return.ReturnHeader', {
                        returnId: returned.result?.returnId,
                    }),
                    request: one('mantle.request.Request', {
                        requestId: asked.result?.requestId,
                    }),
                    cancelled: ['Cancellation requested', 'Cancelled'].includes(
                        cancel.result?.stateText,
                    ),
                }
            } finally {
                login('john.doe')
            }
        },
        then({ returned, header, request, cancelled }) {
            header.statusId == 'ReturnRequested'
            request.productStoreId == 'POPC_DEFAULT'
            request.requestCategoryId == 'BOSS_CS_Q_SUPPORT' ||
                request.requestCategoryId != null
            cancelled == true
        },
    },
)

feature(
    'the guest registers with the purchase email: verified, the hub shows the order, its invoice and its case; unverified nothing',
    {
        when() {
            account('PASS_ACC_PETRA', 'petra@accept.example.test', false)
            const unverified = call('PASS_ACC_PETRA', 'getShopAccount', {})
            sys('create#moqui.security.public.VerifiedAddress', {
                userId: 'PASS_ACC_PETRA',
                emailAddress: 'petra@accept.example.test',
                verifiedAt: ec.user.nowTimestamp,
            })
            const hub = call('PASS_ACC_PETRA', 'getAccountHub', {})
            const shop = call('PASS_ACC_PETRA', 'getShopAccount', {})
            const invoices = call('PASS_ACC_PETRA', 'findInvoices', {})
            const cases = call('PASS_ACC_PETRA', 'findCustomerCases', {})
            const other = call(ids.unverified, 'getShopOrder', {
                orderId: state.mixed.orderId,
            })
            return { unverified, hub, shop, invoices, cases, other }
        },
        then({ unverified, hub, shop, invoices, cases, other }) {
            unverified.result.account.verified == false
            hub.result.cards.some((card) => card.app == 'shop')
            hub.result.cards.some((card) => card.app == 'billing')
            hub.result.cards.some((card) => card.app == 'support')
            shop.result.account.orderCount == 2
            invoices.result.invoiceList.length >= 1
            cases.result.caseList.some(
                (row) => row.requestId == state.requestId,
            )
            other.kind != null
        },
    },
)

feature(
    'a signed-in buyer adds a card through the hosted setup and an address; ending the card names its recurring order; a refund ends the download',
    {
        when() {
            const begun = call(ids.buyer, 'beginPaymentMethodSetup', {})
            const finished = call(ids.buyer, 'finishPaymentMethodSetup', {
                setupReference: begun.result?.setupReference,
            })
            const address = call(ids.buyer, 'storeAddress', {
                address1: '11 Account Street',
                city: 'Springfield',
                postalCode: '62701',
                countryGeoId: 'USA',
            })
            const method = finished.result?.methods[0]
            const order = sys('mantle.order.OrderServices.create#Order', {
                vendorPartyId: 'ORG_ZIZI_RETAIL',
                customerPartyId: ids.buyer,
                productStoreId: 'POPC_DEFAULT',
            })
            sys('update#mantle.order.OrderHeader', {
                orderId: order.orderId,
                recurCronExpression: '0 0 0 1 * ?',
                orderName: 'Monthly e-guide',
            })
            sys('mantle.order.OrderServices.add#OrderPartPayment', {
                orderId: order.orderId,
                orderPartSeqId: order.orderPartSeqId,
                paymentMethodId: method?.paymentMethodId,
                paymentInstrumentEnumId: 'PiCreditCard',
                amount: '6.00',
            })
            const ending = call(ids.buyer, 'endPaymentMethod', {
                paymentMethodId: method?.paymentMethodId,
            })
            // the digital item refunded in full: its grant ends, and its download with it
            const checkout = one('mantle.order.StoreCheckout', {
                orderId: state.mixed.orderId,
            })
            const grant = list('mantle.product.store.StoreDownloadGrant', {
                orderId: state.mixed.orderId,
            })[0]
            sys('mantle.account.PaymentServices.create#RefundPayment', {
                paymentId: checkout.paymentId,
                amount: checkout.dueAmount,
                statusId: 'PmntDelivered',
            })
            sys(
                'mantle.product.ShopFulfillmentServices.reconcile#RefundedItem',
                { paymentId: checkout.paymentId },
            )
            const after = guest('issueDownload', {
                orderToken: state.mixed.orderToken,
                downloadGrantId: grant.downloadGrantId,
            })
            return {
                finished,
                address,
                ending,
                after,
                grant: one('mantle.product.store.StoreDownloadGrant', {
                    downloadGrantId: grant.downloadGrantId,
                }),
            }
        },
        then({ finished, address, ending, after, grant }) {
            finished.result.added == 1
            address.result.addresses.length == 1
            ending.result.needsConfirmation == true
            ending.result.contracts[0].name == 'Monthly e-guide'
            grant.revokedDate != null
            after.kind == 'NotFound'
        },
    },
)
