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
