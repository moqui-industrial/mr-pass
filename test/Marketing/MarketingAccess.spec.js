// PASS Marketing's pages and operations (IronStone impl-marketing P7; design-marketing §13 Subscribe and VerifySubscription; mr-mantle
// mantle.marketing.MarketingPortalServices): Subscribe's one render offers the site's lists unchecked with the consent box, and a
// confirmation link's page shows the request and its Confirm button while changing nothing; the operations are refused alike for a
// site without the mount and a list it does not offer; a request over the address's limit is answered with the same receipt and
// sends no more mail. The four operations are in both copies of the schema and the route list, the request and the confirmation
// bearer writes in the three lists. Mantle's MarketingSubscriptions spec covers the rules (one topic, replays, withdrawals,
// tokens); the acceptance tests MarketingSubscribeHttp and MarketingRemoteHttp go through the pages and a remote frontend.
const fx = ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
const capture = ec.factory.getTool("MailCapture")
const host = "marketing.example.test"
let ids
const run = Date.now().toString(36)
const fresh = name => name + "." + run + "@example.test"
const operationId = () => "pmk" + ec.user.randomString(16).replace(/[^A-Za-z0-9]/g, "")
const render = (path, parameters) => {
    const rendered = ec.screen
        .makeTest()
        .rootScreen("component://mr-pass/screen/Pass.xml")
        .render(
            path,
            {
                resolvedSiteId: ids.siteId,
                publicHost: host,
                publicPath: "/" + path.replace(/^Marketing/, "marketing"),
                ...parameters
            },
            null
        )
    return {html: rendered.output, errors: rendered.errorMessages}
}
const request = (siteId, emailAddress, contactListIds) =>
    fx.call("requestSubscription", {siteId, emailAddress, contactListIds, consent: "Y", operationId: operationId()})
spec({
    setupSpec() {
        capture.enable()
        ids = fx.setup("PMK", "PASS_MKT_PAGES", host)
        logout()
    },
    cleanupSpec() {
        capture.reset()
        login("john.doe")
    }
})
feature("Subscribe offers the site's lists unchecked with the consent box; a confirmation link's page changes nothing", {
    when() {
        capture.clear()
        const subscribe = render("Marketing/Subscribe", {})
        const address = fresh("visitor")
        const receipt = request(ids.siteId, address, [ids.garden])
        const token = fx.tokenTo(capture, address)
        const verify = render("Marketing/VerifySubscription", {token})
        return {subscribe, receipt, token, verify, status: fx.membership(ids.garden, fx.partyOf(address))}
    },
    then({subscribe, receipt, token, verify, status}) {
        subscribe.errors.length === 0
        subscribe.html.includes('id="SubscriptionRequest"')
        subscribe.html.includes("Garden news") &&
            subscribe.html.includes("Kitchen news") &&
            !subscribe.html.includes("Hidden news")
        subscribe.html.includes('value="' + ids.garden + '">') && !subscribe.html.includes("checked")
        subscribe.html.includes('name="consent"') && subscribe.html.includes("Yes, send me Garden news")
        receipt.receipt.message.includes("open the link")
        token != null
        verify.errors.length === 0
        verify.html.includes('id="VerifyForm"') && verify.html.includes("v***@example.test")
        !verify.html.includes(run + "@example.test")
        status === "CLPT_PENDING"
    }
})
feature("refused alike for a site without the mount and an unoffered list; over the address's limit the same receipt, no mail", {
    when() {
        capture.clear()
        const address = fresh("limited")
        const receipts = []
        for (let i = 0; i < 6; i++) receipts.push(request(ids.siteId, address, [ids.kitchen]))
        // the verifications are attempted on a service worker once each request commits
        ec.factory.waitWorkerPoolEmpty(50)
        const party = fx.partyOf(address)
        const groups = new Set(
            fx.lib
                .rows("mantle.marketing.contact.SubscriptionRequest", {partyId: party, contactListId: ids.kitchen})
                .map(r => r.requestGroupId)
        )
        return {
            receipts: receipts.map(r => r.receipt?.message || r.kind),
            mails: Array.from(capture.getMessages()).filter(m => Array.from(m.toList || []).includes(address)).length,
            groups: groups.size,
            noMount: fx.call("getMarketingPublication", {siteId: ids.siteNone}),
            noMountRequest: request(ids.siteNone, fresh("nomount"), [ids.garden]),
            hidden: request(ids.siteId, fresh("hidden"), [ids.hidden]),
            mailbox: request(ids.siteId, fresh("mailbox"), [ids.mailbox]),
            forged: fx.call("getSubscriptionRequest", {siteId: ids.siteId, token: "z".repeat(40)}),
            forgedVerify: fx.call("verifySubscription", {siteId: ids.siteId, token: "z".repeat(40), operationId: operationId()})
        }
    },
    then(r) {
        new Set(r.receipts).size === 1
        r.receipts[0].includes("open the link")
        r.mails === 3
        r.groups === 5
        ;[r.noMount, r.noMountRequest, r.hidden, r.mailbox, r.forged, r.forgedVerify].every(x => x.kind === "NotFound")
        new Set([r.noMount, r.noMountRequest, r.hidden, r.mailbox].map(x => x.error)).size === 1
    }
})
feature("the four operations are in both schema copies and route lists; the request and the confirmation are bearer writes", {
    when() {
        const operations = ["getMarketingPublication", "requestSubscription", "getSubscriptionRequest", "verifySubscription"]
        const pass = ec.resource.script("component://mr-pass/service/pass/Schema.js")
        const mantle = ec.resource.script("component://mr-mantle/service/mantle/forum/ForumSchema.js")
        const routes = [
            ec.resource.script("component://mr-pass/service/pass/Routes.js"),
            ec.resource.script("component://mr-mantle/script/PassRoutes.js")
        ]
        const lists = [
            ec.resource.script("component://mr-pass/service/pass/Transport.js").TOKEN_WRITES,
            ec.resource.script("component://mr-mantle/script/PassApi.js").TOKEN_WRITES,
            ec.resource.script("component://mr-mantle/script/PassAuthority.js").TOKEN_WRITES
        ]
        return {
            schemas: operations.every(op => pass[op] && JSON.stringify(pass[op]) === JSON.stringify(mantle[op])),
            routed: operations.every(op => routes.every(list => list.filter(row => row[2] === op).length === 1)),
            verbs: operations.map(op => routes[0].find(row => row[2] === op)[0]).join(),
            writes: lists.every(
                list =>
                    list.includes("requestSubscription") &&
                    list.includes("verifySubscription") &&
                    !list.includes("getSubscriptionRequest")
            )
        }
    },
    then({schemas, routed, verbs, writes}) {
        schemas === true
        routed === true
        verbs === "GET,POST,GET,POST"
        writes === true
    }
})
