// PASS Marketing's landing pages over HTTP (IronStone impl-marketing P14; design-marketing §8 LandingPages, §16.3 scenario 10, its page
// half), on MarketingPagesFixtures' PASS_HTTP data, with plain requests and no JavaScript: a visitor opens the published storeless
// landing page (no store on the site's Marketing mount) and subscribes from its embedded box, which files a pending request with its
// own verification message (the neutral receipt, nothing echoed); a draft page and an unknown route are Not Found. The records are
// read as john.doe over the authority's entity REST (params.authority, else this server).
const BASE = server.url.replace(/\/$/, "")
const AUTHORITY = String(params.authority || BASE).replace(/\/$/, "")
const GARDEN = "PASS_HTTP_MK_GARDEN"
const ADDRESS = "landing.visitor@example.test"
const operationId = () => "op" + Date.now() + Math.floor(Math.random() * 1e6)
const admin = () => session({user: "john.doe"})
const read = (who, entity, values) => who.get(AUTHORITY + "/rest/e1/" + entity, {params: values, accept: "json"}).json()
feature("a visitor opens the landing page and subscribes from its box; a draft and an unknown page are not found", {
    when() {
        const records = admin()
        const visitor = session()
        const page = visitor.get(BASE + "/marketing/pages/spring")
        const sent = visitor.post(BASE + "/marketing/Subscribe/request", {
            form: {list: GARDEN, contactListId: GARDEN, emailAddress: ADDRESS, consent: "Y", operationId: operationId()},
            follow: true
        })
        const request = waitUntil(
            () => {
                const found = read(records, "mantle.marketing.contact.SubscriptionRequest", {
                    contactListId: GARDEN,
                    orderByField: "-evidenceDate"
                })
                return found.length ? found[0] : null
            },
            {timeout: 20}
        )
        const draft = session().get(BASE + "/marketing/pages/summer")
        const unknown = session().get(BASE + "/marketing/pages/no-such-page")
        return {page, sent: sent.text, request, draft: draft.status, unknown: unknown.status}
    },
    then(r) {
        r.page.status === 200 && r.page.text.includes('id="LandingPage"') && r.page.text.includes("Seedlings are in.")
        r.page.text.includes('action="/marketing/Subscribe/request"') && r.page.text.includes("Garden news")
        r.sent.includes('id="SubscriptionReceipt"') && !r.sent.includes(ADDRESS)
        r.request.statusEnumId === "SrsPending"
        r.draft === 404 && r.unknown === 404
    }
})
