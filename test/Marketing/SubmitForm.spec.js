// PASS Marketing's SubmitForm (IronStone impl-marketing P12; design-marketing §13 SubmitForm; mr-mantle
// mantle.marketing.MarketingPortalServices get#Form and submit#Form): the page's one render asks the open publication's questions
// (named f_<field>, with the separate subscription choice) and shows no score; an unpublished, closed or another site's publication
// and a forged link are not available alike; an answer is kept once, and a submission past the client's limit, an oversized one and
// one naming a field the page never offered are answered with the same neutral receipt and keep nothing. The two operations are in
// both schema copies and route lists, the answer a bearer write in the three lists. Mantle's FormPublications and MarketingForms specs
// cover the rules (hidden fields, the request key, invitations, responses); the acceptance test MarketingFormHttp goes through the page.
const fx = ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
const host = "forms.marketing.example.test"
let ids, pubs
const operationId = () => "pmf" + ec.user.randomString(16).replace(/[^A-Za-z0-9]/g, "")
const submissions = publicationId => fx.lib.rows("mantle.party.FormSubmission", {publicationId}).length
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
const submit = (publicationId, values, siteId = ids.siteId) =>
    fx.call("submitMarketingForm", {siteId, publicationId, values: JSON.stringify(values), operationId: operationId()})
spec({
    setupSpec() {
        ids = fx.setup("PMF", "PASS_MKT_FORMS", host)
        pubs = fx.forms("PMF", ids)
        logout()
    },
    cleanupSpec() {
        login("john.doe")
    }
})
feature(
    "SubmitForm asks the open publication's questions with the subscription choice; unpublished, closed or forged not available",
    {
        when() {
            const page = render("Marketing/SubmitForm", {publication: pubs.open})
            return {
                page,
                draft: fx.call("getMarketingForm", {siteId: ids.siteId, publicationId: pubs.draft}),
                closed: fx.call("getMarketingForm", {siteId: ids.siteId, publicationId: pubs.closed}),
                otherSite: fx.call("getMarketingForm", {siteId: ids.siteNone, publicationId: pubs.open}),
                forged: fx.call("getMarketingForm", {siteId: ids.siteId, token: "z".repeat(48)}),
                closedPost: submit(pubs.closed, {rating: "good"})
            }
        },
        then({page, draft, closed, otherSite, forged, closedPost}) {
            page.errors.length === 0
            page.html.includes('id="PublicForm"') && page.html.includes("How was your visit?")
            page.html.includes('name="f_rating"') && page.html.includes('value="good"') && page.html.includes('name="f_comment"')
            page.html.includes('id="FormSubscription"') && page.html.includes("Yes, send me Garden news")
            page.html.includes("/js/moqui-form-when.js")
            !page.html.includes("score")
            ;[draft, closed, otherSite, forged, closedPost].every(x => x.kind === "NotFound")
            new Set([draft, closed, otherSite].map(x => x.error)).size === 1
        }
    }
)
feature(
    "an answer is kept once; over the client's limit, oversized or naming an unknown field: the same receipt and nothing kept",
    {
        when() {
            const before = submissions(pubs.open)
            const good = submit(pubs.open, {rating: "good", comment: "Lovely"})
            const afterGood = submissions(pubs.open)
            const invalid = submit(pubs.open, {comment: "No rating"})
            const unknown = submit(pubs.open, {rating: "good", injected: "x"})
            const oversized = submit(pubs.open, {rating: "good", comment: "x".repeat(70000)})
            const afterRefused = submissions(pubs.open)
            // the client's limit (30 in ten minutes, the server-side caller's one bucket): the rest answer the receipt and keep nothing
            const receipts = []
            for (let i = 0; i < 30; i++) receipts.push(submit(pubs.open, {rating: "poor"}))
            return {
                before,
                good,
                afterGood,
                invalid,
                unknown,
                oversized,
                afterRefused,
                receipts,
                afterLimit: submissions(pubs.open)
            }
        },
        then(r) {
            r.good.receipt.message === "Thank you for telling us."
            r.afterGood === r.before + 1
            r.invalid.kind === "Unprocessable"
            r.unknown.receipt.message === r.good.receipt.message
            r.oversized.receipt.message === r.good.receipt.message
            r.afterRefused === r.afterGood
            r.receipts.every(x => x.receipt?.message === r.good.receipt.message)
            // three counted already (the good answer, the invalid one's and the unknown field's; the oversized one is refused before
            // the limits count), so 27 more are kept and 3 refused
            r.afterLimit === r.afterRefused + 27
        }
    }
)
feature("the two operations are in both schema copies and route lists; the answer is a bearer write in the three lists", {
    when() {
        const operations = ["getMarketingForm", "submitMarketingForm"]
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
            writes: lists.every(list => list.includes("submitMarketingForm") && !list.includes("getMarketingForm"))
        }
    },
    then({schemas, routed, verbs, writes}) {
        schemas === true
        routed === true
        verbs === "GET,POST"
        writes === true
    }
})
