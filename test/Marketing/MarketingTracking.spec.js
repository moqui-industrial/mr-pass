// PASS Marketing's tracking redirect and pixel (IronStone impl-marketing P15; design-marketing §8 "Capture on the authority", §13.1;
// mr-pass script/TrackingRedirect.js and TrackingPixel.js over mr-mantle mantle.marketing.TrackingServices): a click through the
// redirect is recorded by the two operations with a visitor key (set by a Set-Cookie header, kept as its digest) and no party, locally
// and from a registered remote frontend; a destination, fallback or return address in the request is never followed, and the facade
// refuses an operation input naming one; a client over its limit is still redirected and nothing more is recorded; the pixel always
// answers the same image. The two operations are in both schema copies and route lists, the event in the three TOKEN_WRITES lists.
// The handlers are called with a request and a response of the spec's own, as the servlet container calls them.
const fx = ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
const host = "track.marketing.example.test"
const CLIENT = "passmkttrackspec"
let ids
const redirect = () => ec.resource.script("component://mr-pass/script/TrackingRedirect.js")
const pixel = () => ec.resource.script("component://mr-pass/script/TrackingPixel.js")
// a request and response of the spec's own: the path after the servlet's prefix, its parameters, headers and cookies
function hit(handler, pathInfo, {parameters = {}, headers = {}, cookies = [], method = "GET"} = {}) {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
    const request = {
        method,
        pathInfo,
        secure: true,
        remoteAddr: "192.0.2.10",
        getParameter: name => (Object.hasOwn(parameters, name) ? parameters[name] : null),
        getHeader: name => lower[String(name).toLowerCase()] ?? null,
        getCookies: () => cookies
    }
    const response = {
        status: 200,
        headers: {},
        added: [],
        body: "",
        location: null,
        setStatus(code) {
            this.status = code
        },
        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value
        },
        addHeader(name, value) {
            this.added.push([name.toLowerCase(), value])
        },
        setContentType(type) {
            this.headers["content-type"] = type
        },
        write(value) {
            this.body += typeof value === "string" ? value : "[" + value.length + " bytes]"
        },
        sendRedirect(url) {
            this.status = 302
            this.location = url
        }
    }
    logout()
    try {
        handler[method === "HEAD" ? "doHead" : "doGet"](request, response)
    } finally {
        login("john.doe")
    }
    return response
}
const browser = {"user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15"}
const cookieOf = response =>
    (/mkt_vk=([A-Za-z0-9_-]+)/.exec((response.added.find(([name]) => name === "set-cookie") || [])[1] || "") || [])[1] || null
const eventsOf = trackingCodeId =>
    Array.from(
        ec.entity.find("mantle.marketing.tracking.MarketingTrackingEvent").condition({trackingCodeId}).disableAuthz().list()
    )

spec({
    setupSpec() {
        ids = fx.setup("PMT", "PASS_MKT_TRACK", host)
        const {make, system, row} = fx.lib
        if (!row("mantle.marketing.tracking.TrackingCode", {trackingCodeId: "PMT_LINK"}))
            system(() => {
                const ago = new Date(Date.now() - 86400000)
                make("mantle.marketing.campaign.MarketingPolicy", {organizationPartyId: ids.org, fromDate: ago, visitorKeys: "Y"})
                make("mantle.marketing.campaign.MarketingCampaign", {
                    marketingCampaignId: "PMT_CAMPAIGN",
                    campaignName: "Tracked",
                    organizationPartyId: ids.org,
                    statusId: "MKTG_CAMP_INPROGRESS"
                })
                for (const [trackingCodeId, publicCode] of [
                    ["PMT_LINK", "PmtLink0001"],
                    ["PMT_LIMIT", "PmtLimit001"]
                ])
                    make("mantle.marketing.tracking.TrackingCode", {
                        trackingCodeId,
                        marketingCampaignId: "PMT_CAMPAIGN",
                        organizationPartyId: ids.org,
                        siteId: ids.siteId,
                        publicCode,
                        destinationKindEnumId: "TdkUrl",
                        redirectUrl: "https://" + host + "/marketing/Subscribe",
                        utmSource: "poster",
                        disabled: "N",
                        fromDate: ago
                    })
            })
        setProperty("pass_client_" + CLIENT + "_secret", "pass-mkt-track-secret")
        setProperty("pass_client_" + CLIENT + "_sites", ids.siteId)
    },
    cleanupSpec() {
        login("john.doe")
    }
})

feature("a click through the redirect is recorded with a visitor key and no party, locally and from a remote frontend", {
    when() {
        const first = hit(redirect(), "/" + ids.siteId + "/PmtLink0001", {headers: browser})
        const key = cookieOf(first)
        const second = hit(redirect(), "/" + ids.siteId + "/PmtLink0001", {
            headers: browser,
            cookies: [{name: "mkt_vk", value: key}]
        })
        const asked = hit(redirect(), "/" + ids.siteId + "/PmtLink0001", {headers: Object.assign({"sec-gpc": "1"}, browser)})
        const scanner = hit(redirect(), "/" + ids.siteId + "/PmtLink0001", {headers: {"user-agent": "Mimecast URL scanner"}})
        // a registered remote frontend's event: the authority takes it as a token write with no session
        const remote = ec.resource.script("component://mr-mantle/script/PassAuthority.js").handle({
            operation: "recordTrackingEvent",
            siteId: ids.siteId,
            input: {code: "PmtLink0001", visitorKey: key, kind: "visit"},
            clientId: CLIENT,
            clientVerified: true,
            visitorAddress: "198.51.100.7"
        })
        const unregistered = ec.resource.script("component://mr-mantle/script/PassAuthority.js").handle({
            operation: "recordTrackingEvent",
            siteId: ids.siteId,
            input: {code: "PmtLink0001", kind: "visit"}
        })
        const pixelAnswer = hit(pixel(), "/" + ids.siteId, {parameters: {token: "z".repeat(40)}, headers: browser})
        const keyShaped = /^[A-Za-z0-9_-]{16,}$/.test(key || "")
        return {first, key, keyShaped, second, asked, scanner, remote, unregistered, pixelAnswer, events: eventsOf("PMT_LINK")}
    },
    then(r) {
        r.first.status == 302 &&
            r.first.location == "https://" + host + "/marketing/Subscribe?utm_source=poster&utm_campaign=PMT_CAMPAIGN"
        r.first.headers["cache-control"] == "no-store" && r.first.headers["referrer-policy"] == "no-referrer"
        r.keyShaped && r.first.added[0][1].includes("HttpOnly") && r.first.added[0][1].includes("Secure")
        // the held key is sent again, no new cookie; a browser that asks not to be tracked gets none, nor does a scanner
        r.second.status == 302 && r.second.added.length == 0
        r.asked.status == 302 && r.asked.added.length == 0 && r.scanner.status == 302 && r.scanner.added.length == 0
        r.remote.result.recorded == true
        r.unregistered.error.status == 401 || r.unregistered.error.status == 403
        // five events: three keyless or keyed clicks, the scanner apart, the remote visit; one visitor key, as its digest; no party
        r.events.length == 5
        r.events.filter(event => event.visitorKeyHash).length == 3
        new Set(r.events.filter(event => event.visitorKeyHash).map(event => event.visitorKeyHash)).size == 1
        r.events.every(event => event.visitorKeyHash != r.key && !event.campaignRecipientId)
        r.events.filter(event => event.automated == "Y").length == 1
        r.events.filter(event => event.eventKindEnumId == "MteVisit").length == 1
        r.pixelAnswer.status == 200 && r.pixelAnswer.headers["content-type"] == "image/gif" && r.pixelAnswer.added.length == 0
    }
})

feature(
    "a destination in the request is never followed; the facade refuses an input naming one; an unknown code is the neutral page",
    {
        when() {
            const before = eventsOf("PMT_LINK").length
            const named = hit(redirect(), "/" + ids.siteId + "/PmtLink0001", {
                headers: browser,
                parameters: {
                    url: "https://evil.example.test/",
                    next: "https://evil.example.test/",
                    redirect: "//evil.example.test"
                }
            })
            const refused = fx.call("resolveTrackingLink", {
                siteId: ids.siteId,
                code: "PmtLink0001",
                destination: "https://evil.example.test/"
            })
            const unknown = hit(redirect(), "/" + ids.siteId + "/NoSuchCode1", {headers: browser})
            const otherSite = hit(redirect(), "/" + ids.siteNone + "/PmtLink0001", {headers: browser})
            const malformed = hit(redirect(), "/" + ids.siteId + "/https:/evil.example.test", {headers: browser})
            return {named, refused, unknown, otherSite, malformed, added: eventsOf("PMT_LINK").length - before}
        },
        then(r) {
            r.named.status == 302 &&
                r.named.location.startsWith("https://" + host + "/marketing/Subscribe") &&
                !r.named.location.includes("evil")
            r.refused.kind == "Unprocessable"
            r.unknown.status == 404 && r.unknown.location == null && r.unknown.body.includes("This link is not available")
            r.otherSite.status == 404 && r.otherSite.location == null && r.malformed.status == 404
            !r.unknown.body.includes("NoSuchCode1")
            r.added == 1
        }
    }
)

feature("a client over its limit is still redirected and nothing more is recorded", {
    when() {
        const answers = []
        for (let index = 0; index < 32; index++)
            answers.push(hit(redirect(), "/" + ids.siteId + "/PmtLimit001", {headers: browser}).status)
        return {answers, recorded: eventsOf("PMT_LIMIT").length}
    },
    then(r) {
        r.answers.every(status => status == 302)
        r.recorded == 30
    }
})

feature("the two operations are in both schema copies and route lists; the event is an anonymous write in the three lists", {
    when() {
        const operations = ["resolveTrackingLink", "recordTrackingEvent"]
        const pass = ec.resource.script("component://mr-pass/service/pass/Schema.js")
        const mantle = ec.resource.script("component://mr-mantle/service/mantle/forum/ForumSchema.js")
        const routes = [
            ec.resource.script("component://mr-pass/service/pass/Routes.js"),
            ec.resource.script("component://mr-mantle/script/PassRoutes.js")
        ]
        const transport = ec.resource.script("component://mr-pass/service/pass/Transport.js")
        const lists = [
            transport.TOKEN_WRITES,
            ec.resource.script("component://mr-mantle/script/PassApi.js").TOKEN_WRITES,
            ec.resource.script("component://mr-mantle/script/PassAuthority.js").TOKEN_WRITES
        ]
        logout()
        let routed
        try {
            routed = transport.routeOf("recordTrackingEvent", {code: "PmtLink0001", kind: "click"}).method
        } catch (error) {
            routed = error.moquiErrorKind
        } finally {
            login("john.doe")
        }
        return {
            schemas: operations.every(op => pass[op] && JSON.stringify(pass[op]) === JSON.stringify(mantle[op])),
            fields: pass.recordTrackingEvent.fields.join(),
            routedOnce: operations.every(op => routes.every(list => list.filter(row => row[2] === op).length === 1)),
            verbs: operations.map(op => routes[0].find(row => row[2] === op)[0]).join(),
            writes: lists.every(list => list.includes("recordTrackingEvent") && !list.includes("resolveTrackingLink")),
            routed
        }
    },
    then(r) {
        r.schemas === true && r.routedOnce === true
        r.fields == "siteId,code,token,visitorKey,kind"
        r.verbs == "GET,POST"
        r.writes === true
        r.routed == "POST"
    }
})
