// PASS Marketing's landing pages on the HTTP test community (PASS_HTTP, from PortalFixtures; IronStone impl-marketing P14): on the
// Marketing mount MarketingSubscribeFixtures provisions (MarketingFixtures.js, prefix PASS_HTTP_MK), a published landing page "spring"
// with an embedded subscribe box for the garden list and a draft "summer", for the walk MarketingPagesHttp. Mail is captured.
const mk = () => ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
spec({
    dependsOn: ["PortalFixtures", "MarketingSubscribeFixtures"],
    setupSpec() {
        login("john.doe")
        ec.factory.getTool("MailCapture").enable()
    }
})
feature("provision a published landing page with a subscribe box and a draft one on the Marketing mount", {
    when() {
        const fx = mk()
        const ids = fx.onSite("PASS_HTTP_MK", "PASS_HTTP", "marketing.http.example.test", {
            partyId: "PASS_HTTP_MK_WALKER",
            address: "walker.mk@example.test",
            token: "PASS_HTTP_MK_PREFS" + "0".repeat(22)
        })
        return fx.pages(ids, "# Spring in the garden\n\nSeedlings are in.\n\n[[subscribe " + ids.garden + "]]\n")
    },
    then(pages) {
        pages.spring != null && pages.summer != null
    }
})
