// The Billing and Supplier apps on the HTTP test community (PASS_HTTP, from ClientFixtures): their mounts for a test
// organization, its hosted test gateway, an invoice and a purchase order with known link tokens, and a customer contact
// invited and redeemed. The browser walk (PortalHttp) and the remote check (RemoteHttp) read these, each with its own
// invoice, since the suite's one server serves both in turn.
const settlement = () => ec.resource.script('component://mr-mantle/test/account/AccountingSettlementFixtures.js')
const INVOICE_TOKEN = 'PassPortalInvoiceLinkToken0000000000000000000001'
const ORDER_TOKEN = 'PassPortalOrderLinkToken000000000000000000000001'
const REMOTE_INVOICE_TOKEN = 'PassPortalRemoteInvoiceLinkToken0000000000000001'
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
feature('provision the Billing and Supplier apps with link tokens and an invited contact', {
    when() {
        const siteId = 'PASS_HTTP',
            h = settlement(),
            c = h.call
        const f = h.fixtures('PASS_PORTAL')
        c('create#mantle.account.method.PaymentGatewayConfig', {
            paymentGatewayConfigId: 'PASS_PORTAL_HOSTED',
            paymentGatewayTypeEnumId: 'PgtTest',
            description: 'Hosted test gateway',
            authorizeServiceName: 'mantle.account.PaymentTestServices.hostedPending#PaymentAuthorization',
            captureServiceName: 'mantle.account.PaymentTestServices.alwaysApprove#PaymentCapture',
            // the gateway has not answered yet: the walks show a payment pending after the provider's return
            detailsServiceName: 'mantle.account.PaymentTestServices.alwaysPending#PaymentDetails',
        })
        c('create#mantle.account.method.PaymentGatewayOrganization', {
            organizationPartyId: f.org,
            paymentGatewayConfigId: 'PASS_PORTAL_HOSTED',
            fromDate: 0,
            isEnabled: 'Y',
        })
        const preference = ec.entity
            .find('mantle.ledger.config.PartyAcctgPreference')
            .condition('organizationPartyId', f.org)
            .one()
        c('mantle.ledger.SetupServices.store#Preferences', {
            organizationPartyId: f.org,
            lastUpdatedStamp: preference.lastUpdatedStamp,
            settings: { invoicePayGatewayConfigId: 'PASS_PORTAL_HOSTED' },
            changeReason: 'Billing pages pay through the hosted test gateway',
        })
        const site = ec.entity.find('mantle.public.PublicSite').condition('siteId', siteId).one()
        c('mantle.public.SiteServices.store#Mounts', {
            input: {
                siteId,
                expectedRevision: site.policyRevision,
                mounts: [
                    { app: 'forum', pathPrefix: '/forum' },
                    { app: 'account', pathPrefix: '/account' },
                    { app: 'members', pathPrefix: '/members' },
                    { app: 'sites', pathPrefix: '/sites' },
                    { app: 'billing', pathPrefix: '/billing', targetId: f.org },
                    { app: 'supplier', pathPrefix: '/supplier', targetId: f.org },
                ],
                hosts: [{ hostname: '127.0.0.1', canonical: true }],
            },
        })
        const invoiceId = h.invoice(f, '125')
        const capability = (recordType, recordId, scopes, token) =>
            c('create#mantle.party.ExternalAccessCapability', {
                organizationPartyId: f.org,
                partyId: recordType === 'Invoice' ? f.customer : 'PASS_PORTAL_SUPPLIER',
                recordType,
                recordId,
                scopes,
                tokenDigest: ec.user.singleUseCodeHash(token),
                fromDate: ec.user.nowTimestamp,
                thruDate: new Date(Date.now() + 30 * 86400000),
                createdByUserId: ec.user.userId,
            })
        capability('Invoice', invoiceId, 'InvoicePay', INVOICE_TOKEN)
        // RemoteHttp's own invoice: in the standard run PortalHttp has already started paying the first one
        capability('Invoice', h.invoice(f, '75'), 'InvoicePay', REMOTE_INVOICE_TOKEN)
        // a purchase order from a supplier, approved
        c('create#mantle.party.Party', { partyId: 'PASS_PORTAL_SUPPLIER', partyTypeEnumId: 'PtyOrganization' })
        c('create#mantle.party.Organization', { partyId: 'PASS_PORTAL_SUPPLIER', organizationName: 'Portal supplier' })
        c('create#mantle.party.PartyRole', { partyId: 'PASS_PORTAL_SUPPLIER', roleTypeId: 'Supplier' })
        c('create#mantle.order.OrderHeader', {
            orderId: 'PASS_PORTAL_PO',
            orderName: 'Portal purchase',
            statusId: 'OrderApproved',
            currencyUomId: 'USD',
            grandTotal: 250,
            placedDate: ec.user.nowTimestamp,
        })
        c('create#mantle.order.OrderPart', {
            orderId: 'PASS_PORTAL_PO',
            orderPartSeqId: '01',
            vendorPartyId: 'PASS_PORTAL_SUPPLIER',
            customerPartyId: f.org,
            statusId: 'OrderApproved',
        })
        capability('Order', 'PASS_PORTAL_PO', 'BillUpload', ORDER_TOKEN)
        // a customer contact: a public account invited for the customer, and its redeemed invitation
        login(f.users.ar)
        const invited = c('mantle.party.ExternalAccessServices.invite#Contact', {
            organizationPartyId: f.org,
            app: 'billing',
            partyId: f.customer,
            emailAddress: 'payer@portal.example.test',
        })
        login('john.doe')
        ec.artifactExecution.disableAuthz()
        const payer = c('mantle.party.PartyServices.create#Person', { firstName: 'Portal', lastName: 'Payer' }).partyId
        c('mantle.party.PartyServices.create#PartyUserAccount', {
            partyId: payer,
            username: 'pass.portal.payer',
            emailAddress: 'payer@portal.example.test',
            newPassword: 'moqui1!!',
            newPasswordVerify: 'moqui1!!',
        })
        const userId = ec.entity.find('moqui.security.UserAccount').condition('username', 'pass.portal.payer').one().userId
        c('create#moqui.security.public.VerifiedAddress', {
            userId,
            emailAddress: 'payer@portal.example.test',
            verifiedAt: ec.user.nowTimestamp,
        })
        login('pass.portal.payer', 'moqui1!!')
        const redeemed = c('mantle.public.SiteServices.redeem#Invitation', { input: { siteId, token: invited.token } })
        login('john.doe')
        return { invoiceId, redeemed: redeemed.result, org: f.org }
    },
    then({ invoiceId, redeemed, org }) {
        !!invoiceId
        redeemed.state === 'active'
        ec.entity.find('mantle.public.PublicSiteApp').condition({ siteId: 'PASS_HTTP', app: 'billing' }).one().targetId === org
    },
})
