// PASS Sales' pages at 390 px (IronStone impl-sales P20; design-sales §10), on the PASS_HTTP data of SalesQuoteFixtures,
// SalesOrderFixtures and SalesPhoneFixtures: by a bearer link, a quote's offer (CustomerQuote), a declined quote's receipt
// (QuoteResponse) and an order with its delivery and invoice (CustomerOrder); signed in as the invited contact
// (pass_http_sq_contact), My quotes (CustomerQuotes), the quote, the receipt, My orders (CustomerOrders) and the order. Each page
// shows its main facts and does not scroll sideways at a phone's width. The lists have no link form: a visitor is asked to sign in.
// The walk only reads (the links are those SalesQuoteHttp and SalesOrderHttp read, and SalesPhoneFixtures' own declined quote).
const quoteToken = name => ("PASS_HTTP_SQ" + name + "0".repeat(48)).slice(0, 48)
const orderToken = name => ("PASS_HTTP_SO" + name + "0".repeat(48)).slice(0, 48)
const phoneToken = name => ("PASS_HTTP_SP" + name + "0".repeat(48)).slice(0, 48)
const BASE = "http://127.0.0.1:" + server.port
const viewport = {width: 390, height: 844}
const firstId = (pattern, text) => (pattern.exec(text) || [])[1] || null
// a page at the phone's width: its status, its text, and false when it does not scroll sideways, else the first element past the
// viewport's edge (which the failure then names)
function read(page, path) {
    const status = page.goto(path).status
    const overflow = page.evaluate(() => {
        if (document.documentElement.scrollWidth <= innerWidth) return false
        const width = document.documentElement.clientWidth
        const over = Array.from(document.querySelectorAll("body *")).find(node => node.getBoundingClientRect().right > width + 1)
        return over ? over.tagName + (over.id ? "#" + over.id : "") + (over.className ? "." + over.className : "") : "the page"
    })
    return {status, text: page.text(), overflow}
}
// the ids of the links' quote, declined quote and order, read from the links' pages with plain requests (the receipt's quote is its
// first fact)
function linkIds() {
    const visitor = session()
    const quote = visitor.get(BASE + "/sales/CustomerQuote?token=" + quoteToken("Plain")).text
    const receipt = visitor.get(BASE + "/sales/QuoteResponse?token=" + phoneToken("Answered")).text
    const order = visitor.get(BASE + "/sales/CustomerOrder?token=" + orderToken("Walk")).text
    return {
        plainId: firstId(/Quote (\S+)/, quote),
        answeredId: firstId(/<dt>Quote<\/dt><dd>([^<\s,·]+)/, receipt),
        orderId: firstId(/Order (\S+)/, order)
    }
}

feature("by a bearer link at 390 px: the quote's offer, the declined quote's receipt and the order, none scrolling sideways", {
    when() {
        const page = browser.newPage({viewport})
        const quote = read(page, "/sales/CustomerQuote?token=" + quoteToken("Plain"))
        const receipt = read(page, "/sales/QuoteResponse?token=" + phoneToken("Answered"))
        const order = read(page, "/sales/CustomerOrder?token=" + orderToken("Walk"))
        const quotes = read(page, "/sales/CustomerQuotes")
        return {quote, receipt, order, quotes, ids: linkIds()}
    },
    then({quote, receipt, order, quotes, ids}) {
        quote.status === 200 && receipt.status === 200 && order.status === 200
        ids.plainId != null && ids.answeredId != null && ids.orderId != null
        quote.text.includes("Accept this quote") && quote.text.includes("Decline this quote")
        quote.overflow === false
        receipt.text.includes("Quote declined") && receipt.text.includes("We went with a smaller order")
        receipt.overflow === false
        order.text.includes("PO-HTTP-SO") && order.text.includes("HTTP-SO-TRACK") && order.text.includes("Open:")
        order.overflow === false
        // a list is the signed-in contact's: a visitor is asked to sign in, and sees no quote
        !quotes.text.includes("Quote " + ids.plainId)
    }
})
feature(
    "signed in as the invited contact at 390 px: My quotes, the quote, the receipt, My orders and the order, none scrolling sideways",
    {
        when() {
            const ids = linkIds()
            const page = browser.newPage({viewport})
            page.goto("/account/Login")
            page.getByLabel("Email or username", {exact: true}).fill("pass_http_sq_contact")
            page.getByLabel("Password", {exact: true}).fill("moqui")
            page.getByRole("button", {name: "Sign in", exact: true}).click()
            page.waitFor(() => !location.pathname.endsWith("/Login"), {timeout: 15})
            const quotes = read(page, "/sales/CustomerQuotes")
            const quote = read(page, "/sales/CustomerQuote?orderId=" + encodeURIComponent(ids.plainId || ""))
            const receipt = read(page, "/sales/QuoteResponse?orderId=" + encodeURIComponent(ids.answeredId || ""))
            const orders = read(page, "/sales/CustomerOrders")
            const order = read(page, "/sales/CustomerOrder?orderId=" + encodeURIComponent(ids.orderId || ""))
            return {quotes, quote, receipt, orders, order, ids}
        },
        then({quotes, quote, receipt, orders, order, ids}) {
            quotes.text.includes("My quotes") && quotes.text.includes("Quote " + ids.plainId)
            quotes.text.includes("Quote " + ids.answeredId) && quotes.text.includes("Declined")
            quotes.overflow === false
            quote.text.includes("Quote " + ids.plainId) && quote.text.includes("Accept this quote")
            quote.overflow === false
            receipt.text.includes("Quote declined") && receipt.text.includes(ids.answeredId)
            receipt.overflow === false
            orders.text.includes("My orders") &&
                orders.text.includes("Order " + ids.orderId) &&
                orders.text.includes("PO-HTTP-SO")
            orders.overflow === false
            order.text.includes("Order " + ids.orderId) && order.text.includes("HTTP-SO-TRACK") && order.text.includes("Open:")
            order.overflow === false
        }
    }
)
