// PASS Marketing on the HTTP test community (PASS_HTTP, from PortalFixtures; IronStone impl-marketing P7): the Marketing mount of a
// fixture organization (MarketingFixtures.js, prefix PASS_HTTP_MK) with two lists offered there, a known subscriber with a mailbox
// membership and a list link of a known token, for the walks MarketingSubscribeHttp and MarketingRemoteHttp, locally or through a
// remote frontend. Mail is captured.
const mk = () => ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
spec({
    dependsOn: ["PortalFixtures"],
    setupSpec() {
        login("john.doe")
        ec.factory.getTool("MailCapture").enable()
    }
})
feature("provision PASS Marketing's mount, its two offered lists and a known subscriber", {
    when() {
        return mk().onSite("PASS_HTTP_MK", "PASS_HTTP", "marketing.http.example.test", {
            partyId: "PASS_HTTP_MK_WALKER",
            address: "walker.mk@example.test",
            token: "PASS_HTTP_MK_PREFS" + "0".repeat(22)
        })
    },
    then(ids) {
        ids.garden != null && ids.kitchen != null
    }
})

// The Marketing walks (MarketingSubscribeHttp and the other Marketing*Http specs, MarketingPhonePages) read their records and the
// captured mail as john.doe over entity REST, which grants no entity to anyone by default (docs/security/Attack-Surface.md: AT_ENTITY):
// this test database gives the instance administrators a view of those entities alone.
const READ_GROUP = "PASS_HTTP_MK_RECORDS"
const readEntities = [
    "moqui.basic.email.EmailMessage",
    "mantle.marketing.contact.ContactListParty",
    "mantle.marketing.contact.SubscriptionRequest",
    "mantle.marketing.tracking.MarketingTrackingEvent",
    "mantle.party.FormPublication",
    "mantle.party.FormSubmission",
    "mantle.party.PartyConsent",
    "mantle.party.contact.PartyContactMechInfo",
    "mantle.work.registration.EventRegistration"
]
feature("the Marketing walks' record reader: the instance administrators view the walks' entities over entity REST", {
    when() {
        const was = ec.artifactExecution.disableAuthz()
        try {
            ec.service
                .sync()
                .name("create#moqui.security.ArtifactGroup")
                .parameters({artifactGroupId: READ_GROUP, description: "PASS Marketing walks: records read over entity REST"})
                .call()
            for (const artifactName of readEntities)
                ec.service
                    .sync()
                    .name("create#moqui.security.ArtifactGroupMember")
                    .parameters({artifactGroupId: READ_GROUP, artifactName, artifactTypeEnumId: "AT_ENTITY", nameIsPattern: "N"})
                    .call()
            ec.service
                .sync()
                .name("create#moqui.security.ArtifactAuthz")
                .parameters({
                    artifactAuthzId: READ_GROUP + "_ADMIN",
                    userGroupId: "ADMIN",
                    artifactGroupId: READ_GROUP,
                    authzTypeEnumId: "AUTHZT_ALLOW",
                    authzActionEnumId: "AUTHZA_VIEW"
                })
                .call()
        } finally {
            if (!was) ec.artifactExecution.enableAuthz()
        }
        return {
            members: ec.entity
                .find("moqui.security.ArtifactGroupMember")
                .condition("artifactGroupId", READ_GROUP)
                .disableAuthz()
                .count()
        }
    },
    then({members}) {
        members == readEntities.length
    }
})
