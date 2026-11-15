// PASS Sales' quote pages over HTTP (IronStone impl-sales P13, gate 2; design-sales §14.3 scenarios 7 and 8), on
// SalesQuoteFixtures' PASS_HTTP data: the customer opens the mailed link at 390 px, reads the offer, downloads its PDF, accepts with
// a PO and sees the receipt, and the same link opened again shows the same receipt; with plain requests (which run the same against
// the remote frontend of docs/Deployment.md "Reproducing the remote check"), the invited contact signs in and finds its quote
// under My quotes, while a forged link, another customer's link with this quote's ID and another customer's quote by its ID show
// "not available" and nothing of it.
const token = name => ("PASS_HTTP_SQ" + name + "0".repeat(48)).slice(0, 48)
const BASE = "http://127.0.0.1:" + server.port
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
const quoteId = text => (/Quote ([^\s<]+)/.exec(text) || [])[1] || null
const operationId = () => "op" + Date.now() + Math.floor(Math.random() * 1e6)
feature(
    "the customer opens the mailed link at 390 px, reads the offer and its PDF, accepts with a PO and sees the receipt twice",
    {
        when() {
            const page = browser.newPage({viewport: {width: 390, height: 844}})
            page.goto("/sales/CustomerQuote?token=" + token("Walk"))
            const offer = {text: page.text(), overflow: overflow(page)}
            const pdf = session().get(BASE + "/sales/CustomerQuote/document?token=" + token("Walk"))
            page.getByLabel("Your purchase order number").fill("PO-WALK-1")
            page.getByLabel("Your name").fill("Ann Buyer")
            page.getByRole("checkbox").click()
            page.getByRole("button", {name: "Accept the quote", exact: true}).click()
            page.waitFor(() => location.pathname.endsWith("/QuoteResponse"), {timeout: 15})
            const receipt = {text: page.text(), overflow: overflow(page)}
            page.goto("/sales/QuoteResponse?token=" + token("Walk"))
            const again = page.text()
            page.goto("/sales/CustomerQuote?token=" + token("Walk"))
            const reopened = page.text()
            return {offer, pdf, receipt, again, reopened}
        },
        then({offer, pdf, receipt, again, reopened}) {
            offer.text.includes("Accept this quote") && offer.text.includes("Decline this quote")
            offer.overflow === false
            pdf.status === 200 && pdf.magic === "%PDF"
            receipt.text.includes("Quote accepted") && receipt.text.includes("PO-WALK-1")
            receipt.overflow === false
            again.includes("Quote accepted") && again.includes("PO-WALK-1")
            reopened.includes("See the receipt") && !reopened.includes("Accept the quote")
        }
    }
)
feature(
    "the invited contact finds its quote under My quotes; a forged link, another's link and another's quote are not available",
    {
        when() {
            const visitor = session()
            const forged = visitor.get(BASE + "/sales/CustomerQuote?token=" + "x".repeat(48)).text
            const plainPage = visitor.get(BASE + "/sales/CustomerQuote?token=" + token("Plain")).text
            const plainId = quoteId(plainPage)
            const otherLink = visitor.get(
                BASE + "/sales/CustomerQuote?token=" + token("Other") + "&orderId=" + encodeURIComponent(plainId)
            ).text
            const otherPage = visitor.get(BASE + "/sales/CustomerQuote?token=" + token("Other")).text
            const otherId = quoteId(otherPage)
            const contact = session()
            contact.get(BASE + "/account/Login")
            contact.post(BASE + "/account/Login/save", {
                form: {
                    formAction: "startSession",
                    username: "pass_http_sq_contact",
                    password: "moqui",
                    operationId: operationId()
                }
            })
            const list = contact.get(BASE + "/sales/CustomerQuotes").text
            const own = contact.get(BASE + "/sales/CustomerQuote?orderId=" + encodeURIComponent(plainId)).text
            const others = contact.get(BASE + "/sales/CustomerQuote?orderId=" + encodeURIComponent(otherId)).text
            return {forged, plainId, otherLink, otherId, list, own, others}
        },
        then({forged, plainId, otherLink, otherId, list, own, others}) {
            forged.includes("This quote is not available")
            plainId != null && otherId != null && plainId !== otherId
            otherLink.includes("This quote is not available") && !otherLink.includes("Other Quote Co")
            list.includes("Quote " + plainId) && !list.includes("Quote " + otherId)
            own.includes("Accept this quote")
            others.includes("This quote is not available") && !others.includes("Other Quote Co")
        }
    }
)
