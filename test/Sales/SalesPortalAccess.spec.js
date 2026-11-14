// PASS Sales' quote pages (IronStone impl-sales P13; design-sales §10 CustomerQuote, QuoteResponse, CustomerQuotes): a quote's
// link shows its offer with Accept and Decline; a forged link, a changed order ID and a receipt before any response read "not
// available" and show nothing of the quote; My quotes asks a visitor to sign in. The five operations are in both copies of the
// schema and the route list, respondSalesQuote a bearer write in the three TOKEN_WRITES lists and the PDF a download. Mantle's
// SalesPortal spec covers the rules (scope, binding, one response, the threshold); the acceptance tests SalesQuoteScenarios and
// SalesQuoteHttp go through the pages and a remote frontend. The issue is made without its PDF, so no print is rendered here.
const fx = () => ec.resource.script("component://mr-mantle/test/order/SalesQuoteIssueFixtures.js")
const siteId = "PASS_SALES_PAGES"
const host = "sales.example.test"
let quote
const render = (path, parameters) => {
    const rendered = ec.screen
        .makeTest()
        .rootScreen("component://mr-pass/screen/Pass.xml")
        .render(
            path,
            {resolvedSiteId: siteId, publicHost: host, publicPath: "/" + path.replace(/^Sales/, "sales"), ...parameters},
            null
        )
    return {html: rendered.output, errors: rendered.errorMessages}
}
spec({
    setupSpec() {
        const f = fx().setup("PSP")
        const {orderId} = fx().proposedQuote(f, f.users.rep, f.orgA, f.accounts.a, f.contacts.mailed)
        const other = fx().proposedQuote(f, f.users.rep, f.orgA, f.accounts.a, null).orderId
        fx().system(() => {
            const make = fx().make
            make("mantle.public.PublicSite", {
                siteId,
                name: "Sales pages",
                state: "published",
                registrationMode: "invitation",
                locale: "en",
                timeZone: "UTC",
                policyRevision: 1,
                generation: 1
            })
            make("mantle.public.PublicSiteHost", {hostname: host, siteId, canonical: "Y"})
            make("mantle.public.PublicSiteApp", {
                siteId,
                appMountId: "sales",
                app: "sales",
                pathPrefix: "/sales",
                enabled: "Y",
                targetId: f.orgA
            })
            make("mantle.public.PublicSiteApp", {
                siteId,
                appMountId: "account",
                app: "account",
                pathPrefix: "/account",
                enabled: "Y"
            })
            // the issue as send#Quote makes it, without its PDF, and the recipient's link
            const order = fx().one("mantle.order.OrderHeader", {orderId})
            const part = fx().one("mantle.order.OrderPart", {orderId, orderPartSeqId: "01"})
            make("mantle.sales.quote.SalesQuoteIssue", {
                orderId,
                orderPartSeqId: "01",
                orderRevision: order.orderRevision,
                organizationPartyId: f.orgA,
                customerPartyId: f.accounts.a,
                issuedDate: ec.user.nowTimestamp,
                validFromDate: ec.user.nowTimestamp,
                validThruDate: part.validThruDate
            })
            const link = ec.resource
                .script("component://mr-mantle/service/mantle/party/ExternalAccess.js")
                .create({
                    recordType: "SalesOrder",
                    recordId: orderId,
                    scopes: "QuoteView,QuoteRespond",
                    recordRevision: order.orderRevision,
                    thruDate: part.validThruDate
                })
            quote = {orderId, other, token: link.token, url: link.url}
        })
        logout()
    },
    cleanupSpec() {
        login("john.doe")
    }
})
feature(
    "a quote's link shows the offer with Accept and Decline; a forged link, a changed ID and an early receipt read not available",
    {
        when() {
            return {
                page: render("Sales/CustomerQuote", {token: quote.token}),
                forged: render("Sales/CustomerQuote", {token: "x".repeat(48)}).html,
                changed: render("Sales/CustomerQuote", {token: quote.token, orderId: quote.other}).html,
                receipt: render("Sales/QuoteResponse", {token: quote.token}).html,
                list: render("Sales/CustomerQuotes", {}).html
            }
        },
        then({page, forged, changed, receipt, list}) {
            quote.url.startsWith("https://" + host + "/sales/CustomerQuote?token=")
            page.errors.length === 0
            page.html.includes("Quote " + quote.orderId)
            page.html.includes('id="AcceptQuote"') && page.html.includes('id="DeclineQuote"')
            page.html.includes('name="acknowledge"') && page.html.includes('name="token" value="' + quote.token + '"')
            page.html.includes("Account a")
            ;[forged, changed].every(
                html =>
                    html.includes("This quote is not available") && !html.includes("Account a") && !html.includes("AcceptQuote")
            )
            receipt.includes("This receipt is not available") && !receipt.includes("Account a")
            list.includes("Sign in to see the quotes")
        }
    }
)
feature("the five operations are in both schema copies and route lists; the response is a bearer write in all three lists", {
    when() {
        const operations = [
            "findSalesQuotes",
            "getSalesQuote",
            "getSalesQuoteDocument",
            "respondSalesQuote",
            "getSalesQuoteResponse"
        ]
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
            post: routes[0].find(row => row[2] === "respondSalesQuote")[0],
            writes: lists.every(list => list.includes("respondSalesQuote") && !list.includes("getSalesQuote"))
        }
    },
    then({schemas, routed, post, writes}) {
        schemas === true
        routed === true
        post === "POST"
        writes === true
    }
})
