// The Billing and Supplier apps through the PASS facade and their pages: a supplier's scanned bill upload, the pay link's
// page and its refusals, and the app registration both sides share. Mantle's AccountingPortals spec covers the capability
// and payment services themselves.
const settlement = () => ec.resource.script('component://mr-mantle/test/AccountingSettlementFixtures.js')
const ORDER_TOKEN = 'PortalsSpecOrderLinkToken00000000000000000000001'
const INVOICE_TOKEN = 'PortalsSpecInvoiceLinkToken000000000000000000001'
const siteId = 'PASS_PORTALS'
let f, invoiceId
const facade = (operation, input) => {
    try {
        return ec.service
            .sync()
            .throwOnError(true)
            .name('pass.Facade.call#Operation')
            .parameters({ operation, input: { siteId, ...input } })
            .call().result
    } catch (error) {
        ec.message.clearErrors()
        return { errorKind: error.moquiErrorKind || 'Error', errorMessage: String(error.message) }
    }
}
// A submission with its file, as the authority receives it: a browser upload (name, size, type and a write to the staging
// location). A function-bearing upload does not cross a service call, so the spec calls the module in a transaction of its
// own, as no one signed in, as Media's spec stages an attachment; PortalHttp sends real multipart requests.
const submit = (input, upload) =>
    parallel(
        1,
        (thread, args) => {
            const text = args.text
            try {
                return ec.resource.script('component://mr-mantle/service/mantle/account/Portal.js').execute('submitSupplierBill', {
                    ...args.input,
                    file: {
                        name: args.name,
                        size: text.length,
                        contentType: args.contentType,
                        write: (location) => ec.resource.getLocationReference(location).putText(text),
                    },
                })
            } catch (error) {
                ec.message.clearErrors()
                return { errorKind: error.moquiErrorKind || 'Error', errorMessage: String(error.message) }
            }
        },
        { input: { siteId, ...input }, ...upload },
        { transaction: true, timeout: 30 },
    )[0]
const upload = (name, text, contentType = 'application/pdf') => ({ name, text, contentType })
const render = (path, parameters) => {
    const rendered = ec.screen
        .makeTest()
        .rootScreen('component://mr-pass/screen/Pass.xml')
        .render(path, { resolvedSiteId: siteId, publicHost: 'portals.example.test', publicPath: '/' + path.toLowerCase(), ...parameters }, null)
    return { html: rendered.output, errors: rendered.errorMessages }
}
spec({
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
        const h = settlement(),
            c = h.call
        f = h.fixtures('PASS_PORTALS')
        c('create#mantle.public.PublicSite', {
            siteId,
            name: 'Portals community',
            state: 'published',
            registrationMode: 'invitation',
            locale: 'en',
            timeZone: 'UTC',
            policyRevision: 1,
            generation: 1,
        })
        c('create#mantle.public.PublicSiteParty', { siteId, partyId: ec.user.userAccount.partyId, state: 'active', role: 'owner', revision: 1 })
        c('mantle.public.SiteServices.store#Mounts', {
            input: {
                siteId,
                expectedRevision: 1,
                mounts: [
                    { app: 'forum', pathPrefix: '/forum' },
                    { app: 'account', pathPrefix: '/account' },
                    { app: 'billing', pathPrefix: '/billing', targetId: f.org },
                    { app: 'supplier', pathPrefix: '/supplier', targetId: f.org },
                ],
                hosts: [{ hostname: 'portals.example.test', canonical: true }],
            },
        })
        c('create#mantle.party.Party', { partyId: 'PASS_PORTALS_SUPPLIER', partyTypeEnumId: 'PtyOrganization' })
        c('create#mantle.party.Organization', { partyId: 'PASS_PORTALS_SUPPLIER', organizationName: 'Portals supplier' })
        c('create#mantle.order.OrderHeader', {
            orderId: 'PASS_PORTALS_PO',
            orderName: 'Portals purchase',
            statusId: 'OrderApproved',
            currencyUomId: 'USD',
            grandTotal: 300,
            placedDate: ec.user.nowTimestamp,
        })
        c('create#mantle.order.OrderPart', {
            orderId: 'PASS_PORTALS_PO',
            orderPartSeqId: '01',
            vendorPartyId: 'PASS_PORTALS_SUPPLIER',
            customerPartyId: f.org,
            statusId: 'OrderApproved',
        })
        c('create#mantle.account.method.PaymentGatewayConfig', {
            paymentGatewayConfigId: 'PASS_PORTALS_HOSTED',
            paymentGatewayTypeEnumId: 'PgtTest',
            description: 'Hosted test gateway',
            authorizeServiceName: 'mantle.account.PaymentTestServices.hostedPending#PaymentAuthorization',
            detailsServiceName: 'mantle.account.PaymentTestServices.alwaysApprove#PaymentDetails',
        })
        c('create#mantle.account.method.PaymentGatewayOrganization', {
            organizationPartyId: f.org,
            paymentGatewayConfigId: 'PASS_PORTALS_HOSTED',
            fromDate: 0,
            isEnabled: 'Y',
        })
        c('update#mantle.ledger.config.PartyAcctgPreference', {
            organizationPartyId: f.org,
            invoicePayGatewayConfigId: 'PASS_PORTALS_HOSTED',
        })
        invoiceId = h.invoice(f, '90')
        const capability = (recordType, recordId, partyId, scopes, token) =>
            c('create#mantle.party.ExternalAccessCapability', {
                organizationPartyId: f.org,
                partyId,
                recordType,
                recordId,
                scopes,
                tokenDigest: ec.user.singleUseCodeHash(token),
                fromDate: ec.user.nowTimestamp,
                thruDate: new Date(Date.now() + 86400000),
            })
        capability('Order', 'PASS_PORTALS_PO', 'PASS_PORTALS_SUPPLIER', 'BillUpload', ORDER_TOKEN)
        capability('Invoice', invoiceId, f.customer, 'InvoicePay', INVOICE_TOKEN)
    },
    setup() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
    },
    cleanup() {
        login('john.doe')
    },
})

feature('a supplier bill upload is scanned, makes an incoming draft and never approves it; a repeat answers the first', {
    when() {
        logout()
        const order = facade('getSubmission', { token: ORDER_TOKEN })
        const quarantined = submit(
            {
                token: ORDER_TOKEN,
                referenceNumber: 'SUP-Q',
                operationId: 'portals-bill-0000',
            },
            upload('bill.pdf', 'quarantine fixture'),
        )
        const first = submit(
            {
                token: ORDER_TOKEN,
                referenceNumber: 'SUP-100',
                invoiceDate: '2026-10-30',
                amount: '120.50',
                operationId: 'portals-bill-0001',
            },
            upload('bill-100.pdf', '%PDF-1.4 supplier bill'),
        )
        const sameOperation = submit(
            {
                token: ORDER_TOKEN,
                referenceNumber: 'SUP-100',
                operationId: 'portals-bill-0001',
            },
            upload('bill-100.pdf', '%PDF-1.4 supplier bill'),
        )
        const sameReference = submit(
            {
                token: ORDER_TOKEN,
                referenceNumber: 'SUP-100',
                operationId: 'portals-bill-0002',
            },
            upload('bill-100b.pdf', '%PDF-1.4 again'),
        )
        const receipt = facade('getSubmission', { token: ORDER_TOKEN, submissionId: first.submission?.submissionId })
        const foreign = facade('getSubmission', { token: ORDER_TOKEN.replace('1', '2') })
        login('john.doe')
        ec.artifactExecution.disableAuthz()
        const lib = settlement().lib
        const bill = lib.one('mantle.account.invoice.Invoice', { invoiceId: first.submission?.billReference })
        return {
            order,
            quarantined,
            first,
            sameOperation,
            sameReference,
            receipt,
            foreign,
            bill,
            items: lib.rows('mantle.account.invoice.InvoiceItem', { invoiceId: bill?.invoiceId }),
            content: lib.rows('mantle.account.invoice.InvoiceContent', { invoiceId: bill?.invoiceId }),
            bills: lib.rows('mantle.account.invoice.Invoice', { fromPartyId: 'PASS_PORTALS_SUPPLIER' }),
        }
    },
    then({ order, quarantined, first, sameOperation, sameReference, receipt, foreign, bill, items, content, bills }) {
        order.order.orderId === 'PASS_PORTALS_PO'
        order.order.orderName === 'Portals purchase'
        order.submissionList.length === 0
        quarantined.errorKind === 'Unprocessable'
        first.submission.referenceNumber === 'SUP-100'
        first.submission.stateText === 'Received for review'
        sameOperation.alreadyApplied === true
        sameOperation.submission.submissionId === first.submission.submissionId
        sameReference.alreadyApplied === true
        sameReference.submission.submissionId === first.submission.submissionId
        receipt.submission.filename === 'bill-100.pdf'
        foreign.errorKind === 'NotFound'
        bill.statusId === 'InvoiceIncoming'
        bill.toPartyId === f.org
        bill.referenceNumber === 'SUP-100'
        items.length === 1
        toDecimal(items[0].amount).eq(toDecimal('120.50'))
        content.length === 1
        bills.length === 1
    },
})

feature('the pay link page shows the invoice with no internal navigation; a bad link and an unknown field are refused', {
    when() {
        logout()
        const page = render('Billing/InvoicePay', { token: INVOICE_TOKEN })
        const bad = render('Billing/InvoicePay', { token: 'x'.repeat(48) })
        const bill = render('Supplier/BillUpload', { token: ORDER_TOKEN })
        const unknownField = facade('getInvoice', { token: INVOICE_TOKEN, organizationPartyId: f.org })
        login('john.doe')
        return { page, bad, bill, unknownField }
    },
    then({ page, bad, bill, unknownField }) {
        page.errors.length === 0
        page.html.includes('Invoice ' + invoiceId)
        page.html.includes('$90.00')
        page.html.includes('Pay this invoice')
        page.html.includes('aria-label="Billing"')
        !page.html.includes('/forum/Compose')
        !page.html.includes('Chatter')
        bad.html.includes('This page is not available')
        !bad.html.includes(invoiceId)
        bill.errors.length === 0
        bill.html.includes('Bill for order PASS_PORTALS_PO')
        bill.html.includes('Your bill number')
        unknownField.errorKind === 'Unprocessable'
    },
})

feature('PASS and the authority register the same apps, and only Billing and Supplier take a target', {
    when() {
        const pass = ec.resource.script('component://mr-pass/service/pass/Apps.js')
        const mantle = ec.resource.script('component://mr-mantle/service/mantle/public/PublicApps.js').apps
        return {
            pass: Object.keys(pass).sort().join(),
            mantle: Object.keys(mantle).sort().join(),
            targeted: Object.keys(mantle)
                .filter((app) => mantle[app].target)
                .sort()
                .join(),
            route: ec.service
                .sync()
                .name('pass.RouteServices.resolve#Route')
                .parameters({ siteId, hostname: 'portals.example.test', path: '/billing/InvoicePay/return' })
                .call().screenPath,
        }
    },
    then({ pass, mantle, targeted, route }) {
        pass === mantle
        targeted === 'billing,supplier'
        route === '/Billing/InvoicePay/return'
    },
})
