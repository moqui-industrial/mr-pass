// PASS Marketing's tracking redirect and pixel over HTTP (IronStone impl-marketing P15; design-marketing §8 "Capture on the authority",
// §18), on MarketingTrackingFixtures' PASS_HTTP data, with plain requests and no JavaScript: a campaign link's QR address redirects to
// the published landing page with its UTM values, sets the visitor key (HttpOnly, no session cookie) and counts one visitor by key
// whatever visits follow, the page carrying the code adding a visit with the same key; a destination in the query is never followed;
// an unknown link is the neutral page; the pixel answers an image whatever its token. Against the remote frontend of docs/Deployment.md
// "Reproducing the remote check" (params.authority its authority) every answer comes over the authority connection, the frontend having
// no Mantle; against `./moq accept mr-pass`'s served server (a local authority) it checks the same. The records are read as john.doe
// over the authority's entity REST.
const BASE = server.url.replace(/\/$/, "")
const AUTHORITY = String(params.authority || BASE).replace(/\/$/, "")
const read = (who, entity, values) => who.get(AUTHORITY + "/rest/e1/" + entity, {params: values, accept: "json"}).json()
const browser = {"User-Agent": "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile Safari"}
feature("a QR scan redirects to the landing page and counts one visitor by key; a query destination is never followed", {
    when() {
        const records = session({user: "john.doe"})
        const before = read(records, "mantle.marketing.tracking.MarketingTrackingEvent", {
            trackingCodeId: "PASS_HTTP_MK_TRK"
        }).length
        const visitor = session()
        const scanned = visitor.get(BASE + "/trk/PASS_HTTP/PassHttpTrk01", {headers: browser, follow: false})
        const cookie = String(scanned.header("set-cookie") || "")
        const key = (/mkt_vk=([A-Za-z0-9_-]+)/.exec(cookie) || [])[1] || ""
        const again = visitor.get(BASE + "/trk/PASS_HTTP/PassHttpTrk01?next=https://evil.example.test/", {
            headers: Object.assign({Cookie: "mkt_vk=" + key}, browser),
            follow: false
        })
        const page = visitor.get(BASE + "/marketing/pages/spring?tc=PassHttpTrk01", {
            headers: Object.assign({Cookie: "mkt_vk=" + key}, browser)
        })
        const unknown = session().get(BASE + "/trk/PASS_HTTP/NoSuchCode1", {headers: browser, follow: false})
        const pixel = session().get(BASE + "/trk-o/PASS_HTTP?token=" + "q".repeat(40), {headers: browser, follow: false})
        const events = waitUntil(
            () => {
                const found = read(records, "mantle.marketing.tracking.MarketingTrackingEvent", {
                    trackingCodeId: "PASS_HTTP_MK_TRK"
                })
                return found.length >= before + 3 ? found : null
            },
            {timeout: 20}
        )
        return {scanned, cookie, key, again, page, unknown, pixel, events: events.slice(before)}
    },
    then(r) {
        r.scanned.status === 302 &&
            String(r.scanned.header("location")).includes("/marketing/pages/spring?utm_source=poster&utm_medium=qr")
        r.key.length >= 16 && r.cookie.includes("HttpOnly") && !/moqui\.session|JSESSIONID/i.test(r.cookie)
        r.again.status === 302 && !String(r.again.header("location")).includes("evil")
        r.page.status === 200 && r.page.text.includes('id="LandingPage"')
        r.unknown.status === 404 && r.unknown.text.includes("This link is not available")
        r.pixel.status === 200 && String(r.pixel.header("content-type")).startsWith("image/gif")
        // two clicks and a page visit, one visitor key (its digest), no party
        r.events.length === 3 && new Set(r.events.map(e => e.visitorKeyHash)).size === 1 && !!r.events[0].visitorKeyHash
        r.events.every(e => !e.campaignRecipientId && e.visitorKeyHash !== r.key)
        r.events.filter(e => e.eventKindEnumId === "MteVisit").length === 1
    }
})
