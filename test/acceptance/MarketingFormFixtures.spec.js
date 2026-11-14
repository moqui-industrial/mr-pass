// PASS Marketing's SubmitForm on the HTTP test community (PASS_HTTP, from PortalFixtures; IronStone impl-marketing P12): the Marketing
// mount of the fixture organization MarketingSubscribeFixtures provisions (MarketingFixtures.js, prefix PASS_HTTP_MK: one organization
// is a site's Marketing target) with its visit survey open to anyone, a draft and a closed publication, and an invited publication
// with its known subscriber's invitation link of a known token (prefix PASS_HTTP_MF), for the walk MarketingFormHttp. Mail is captured.
const mk = () => ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
const SITE_PREFIX = "PASS_HTTP_MK"
const PREFIX = "PASS_HTTP_MF"
const TOKEN = PREFIX + "_INVITE" + "0".repeat(26)
spec({
    dependsOn: ["PortalFixtures", "MarketingSubscribeFixtures"],
    setupSpec() {
        login("john.doe")
        ec.factory.getTool("MailCapture").enable()
    }
})
feature("provision the Marketing mount, a public, a draft, a closed and an invited publication with a known invitation link", {
    when() {
        const fx = mk()
        const ids = fx.onSite(SITE_PREFIX, "PASS_HTTP", "marketing.http.example.test", {
            partyId: SITE_PREFIX + "_WALKER",
            address: "walker.mk@example.test",
            token: SITE_PREFIX + "_PREFS" + "0".repeat(22)
        })
        const pubs = fx.forms(PREFIX, ids)
        const lib = fx.lib
        lib.system(() => {
            if (lib.row("mantle.party.FormPublication", {publicationId: PREFIX + "_INVITED"})) return
            lib.make("mantle.party.FormPublication", {
                publicationId: PREFIX + "_INVITED",
                formId: pubs.formId,
                purposeEnumId: "FppSurvey",
                organizationPartyId: ids.org,
                siteId: "PASS_HTTP",
                accessEnumId: "FpaInvited",
                repeatEnumId: "FprOnce",
                description: "Invited survey",
                completionMessage: "Thank you for answering.",
                fromDate: new Date(Date.now() - 86400000)
            })
            lib.make("mantle.party.FormInvitation", {
                invitationId: PREFIX + "_INVITATION",
                publicationId: PREFIX + "_INVITED",
                formId: pubs.formId,
                organizationPartyId: ids.org,
                partyId: SITE_PREFIX + "_WALKER",
                emailAddress: "walker.mk@example.test",
                invitationKey: PREFIX + ":invited",
                statusEnumId: "FinSent",
                expireDate: new Date(Date.now() + 30 * 86400000)
            })
            lib.make("mantle.party.ExternalAccessCapability", {
                organizationPartyId: ids.org,
                partyId: SITE_PREFIX + "_WALKER",
                recordType: "FormInvitation",
                recordId: PREFIX + "_INVITATION",
                scopes: "MarketingSurvey",
                tokenDigest: ec.user.singleUseCodeHash(TOKEN),
                issuerKind: "organization",
                fromDate: new Date(Date.now() - 86400000),
                thruDate: new Date(Date.now() + 30 * 86400000)
            })
        })
        return pubs
    },
    then(pubs) {
        pubs.open != null && pubs.draft != null && pubs.closed != null
    }
})
