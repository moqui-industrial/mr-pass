// Customer Service's Support app on the HTTP test community (PASS_HTTP, from PortalFixtures; impl-customer-service P13): its
// support mount for PortalFixtures' organization, a customer, and two resolved cases' feedback invitations with their link
// tokens (SupportFixtures.js): one for the browser walk (SupportFeedbackHttp), one for RemoteHttp, each with an expired and
// a withdrawn link beside it.
const fixtures = () =>
    ec.resource.script('component://mr-pass/test/Support/SupportFixtures.js')
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
feature("provision the Support app's mount and its feedback links", {
    when() {
        const c = (name, parameters) =>
            ec.service
                .sync()
                .name(name)
                .parameters(parameters)
                .disableAuthz()
                .call()
        const siteId = 'PASS_HTTP'
        const org = ec.entity
            .find('mantle.public.PublicSiteApp')
            .condition({ siteId, app: 'billing' })
            .disableAuthz()
            .one().targetId
        c('create#mantle.public.PublicSiteApp', {
            siteId,
            appMountId: 'support',
            app: 'support',
            pathPrefix: '/support',
            enabled: 'Y',
            targetId: org,
        })
        const customer = 'PASS_HTTP_FB_CUST'
        c('create#mantle.party.Party', {
            partyId: customer,
            partyTypeEnumId: 'PtyOrganization',
            ownerPartyId: org,
        })
        c('create#mantle.party.Organization', {
            partyId: customer,
            organizationName: 'Feedback Customer Co',
        })
        c('create#mantle.party.PartyRole', {
            partyId: customer,
            roleTypeId: 'Customer',
        })
        const walk = fixtures().feedback({
            prefix: 'PASS_HTTP_FB',
            org,
            customer,
        })
        const remote = fixtures().feedback({
            prefix: 'PASS_HTTP_RFB',
            org,
            customer,
        })
        return { walk, remote }
    },
    then({ walk, remote }) {
        walk.tokens.open.length === 48
        remote.invitationId === 'PASS_HTTP_RFB_INV_OPEN'
    },
})
