// Purchasing's Supplier pages on the HTTP test community (PASS_HTTP, from PortalFixtures): an RFQ quote of PortalFixtures'
// supplier with its link, a competitor's quote, a purchase order at revision 2 with its link and revision 1's
// (SupplierFixtures.js), a second order and quote for RemoteHttp, and a supplier contact (pass.portal.supplier) with its
// grant for the supplier. SupplierPortalHttp and RemoteHttp read these.
const fixtures = () =>
    ec.resource.script('component://mr-pass/test/Supplier/SupplierFixtures.js')
spec({
    dependsOn: ['PortalFixtures'],
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
    },
    cleanupSpec() {
        ec.artifactExecution.enableAuthz()
    },
})
feature(
    "provision the Supplier app's quote and order links and a signed-in supplier contact",
    {
        when() {
            const c = (name, parameters) =>
                ec.service
                    .sync()
                    .name(name)
                    .parameters(parameters)
                    .disableAuthz()
                    .call()
            const org = ec.entity
                .find('mantle.public.PublicSiteApp')
                .condition({ siteId: 'PASS_HTTP', app: 'supplier' })
                .disableAuthz()
                .one().targetId
            const walk = fixtures().documents({
                prefix: 'PASS_HTTP_SUP',
                org,
                supplierPartyId: 'PASS_PORTAL_SUPPLIER',
            })
            const remote = fixtures().documents({
                prefix: 'PASS_HTTP_RSUP',
                org,
                supplierPartyId: 'PASS_PORTAL_SUPPLIER',
            })
            const contact = c('mantle.party.PartyServices.create#Person', {
                firstName: 'Portal',
                lastName: 'Supplier',
            }).partyId
            c('mantle.party.PartyServices.create#PartyUserAccount', {
                partyId: contact,
                username: 'pass.portal.supplier',
                emailAddress: 'sales@portal-supplier.example.test',
                newPassword: 'moqui1!!',
                newPasswordVerify: 'moqui1!!',
            })
            const userId = ec.entity
                .find('moqui.security.UserAccount')
                .condition('username', 'pass.portal.supplier')
                .disableAuthz()
                .one().userId
            c('create#moqui.security.public.VerifiedAddress', {
                userId,
                emailAddress: 'sales@portal-supplier.example.test',
                verifiedAt: ec.user.nowTimestamp,
            })
            // the grant redeeming an invite#Contact invitation makes (PortalFixtures redeems one for the Billing contact)
            c('create#mantle.party.ExternalAccessContact', {
                partyId: contact,
                outsidePartyId: 'PASS_PORTAL_SUPPLIER',
                organizationPartyId: org,
                app: 'supplier',
                fromDate: ec.user.nowTimestamp,
            })
            return { walk, remote }
        },
        then({ walk, remote }) {
            walk.tokens.quote.length === 48
            remote.orderId === 'PASS_HTTP_RSUP_PO'
        },
    },
)
