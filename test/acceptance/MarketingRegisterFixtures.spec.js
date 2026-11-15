// PASS Marketing's Register and Registration on the HTTP test community (PASS_HTTP, from PortalFixtures; IronStone impl-marketing P17):
// on the Marketing mount MarketingSubscribeFixtures provisions (prefix PASS_HTTP_MK), a free published offer of three seats (two a
// registration) with a waitlist of two (MarketingFixtures.js registrations, prefix PASS_HTTP_MR), for the walk MarketingRegisterHttp.
// Mail is captured.
const mk = () => ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
spec({
    dependsOn: ["PortalFixtures", "MarketingSubscribeFixtures"],
    setupSpec() {
        login("john.doe")
        ec.factory.getTool("MailCapture").enable()
    }
})
feature("provision a free published offer with a waitlist on the Marketing mount", {
    when() {
        const fx = mk()
        const ids = fx.onSite("PASS_HTTP_MK", "PASS_HTTP", "marketing.http.example.test", {
            partyId: "PASS_HTTP_MK_WALKER",
            address: "walker.mk@example.test",
            token: "PASS_HTTP_MK_PREFS" + "0".repeat(22)
        })
        const offer = fx.registrations("PASS_HTTP_MR", ids)
        return {offer: fx.lib.row("mantle.work.registration.EventRegistrationPolicy", {registrationPolicyId: offer.offer})}
    },
    then({offer}) {
        offer != null && offer.statusId == "ErpPublished" && offer.totalSeats == 3
    }
})
