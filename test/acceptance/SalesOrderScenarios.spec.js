// PASS Sales' order scenarios (IronStone impl-sales P17; design-sales §14.3 scenario 8, its order half; §10 CustomerOrders and
// CustomerOrder): a direct order's placement mails its confirmation with the recipient's link, which shows that one order read
// only (no edit, cancel or payment form) and nothing of another order; once it ships and is invoiced, a contact of the account
// signs in, finds it under My orders with its delivery and billing state, follows the shipment's tracking and opens the invoice in
// Billing; no changed ID, quote link or other account shows another customer's order. Through pass.Facade (the local authority)
// and the pages' renders; standalone (SalesQuoteFixtures, SalesOrderFixtures). The browser walk and the remote frontend are
// SalesOrderHttp.
// Run: ./moq accept mr-pass --spec SalesOrderScenarios
const sq = () => ec.resource.script("component://mr-pass/test/Sales/SalesQuoteFixtures.js")
const so = () => ec.resource.script("component://mr-pass/test/Sales/SalesOrderFixtures.js")
const capture = ec.factory.getTool("MailCapture")
const siteId = "PASS_SALES_SOS"
const host = "orders.example.test"
let f
const shared = {}
/* A PASS operation as the facade calls it, as an account (null: a visitor): its result, or the refusal's kind and message. */
function op(username, operation, input) {
    if (username) login(username, "moqui")
    else logout()
    ec.message.pushErrors()
    try {
        return ec.service
            .sync()
            .throwOnError(true)
            .name("pass.Facade.call#Operation")
            .parameters({operation, input: {siteId, ...input}})
            .call().result
    } catch (error) {
        return {kind: error.moquiErrorKind || "Error", error: String(error.message)}
    } finally {
        ec.message.clearErrors()
        ec.message.popErrors()
        login("john.doe")
    }
}
function render(username, path, parameters) {
    if (username) login(username, "moqui")
    else logout()
    try {
        const base = path.replace(/^Sales/, "sales").replace(/^Billing/, "billing")
        const rendered = ec.screen
            .makeTest()
            .rootScreen("component://mr-pass/screen/Pass.xml")
            .render(path, {resolvedSiteId: siteId, publicHost: host, publicPath: "/" + base, ...parameters}, null)
        return rendered.output
    } finally {
        login("john.doe")
    }
}
const tokenOf = body => {
    const found = /\/sales\/CustomerOrder\?token=([^"'\s<&]+)/.exec(String(body || ""))
    return found ? decodeURIComponent(found[1]) : null
}
spec({
    stepwise: true,
    setupSpec() {
        capture.enable()
        f = sq().setup("PASS_SOS")
        sq().mount(siteId, f.orgA, host)
        shared.seller = so().seller(f)
        shared.contact = sq().account("pass_sos_buyer", "pass_sos_buyer@buyer.example.test", f.accounts.a, f.orgA)
        so().billing(siteId, f.orgA, shared.contact, f.accounts.a)
    },
    cleanupSpec() {
        capture.reset()
        login("john.doe")
    }
})
feature("the confirmation's link shows that one order, read only, and nothing of another order", {
    when() {
        capture.clear()
        const orderId = so().placed(f, shared.seller, f.accounts.a, {
            contactPartyId: f.contacts.mailed,
            otherPartyOrderId: "PO-SOS-1"
        })
        const mail = capture.getMessages().find(message => String(message.subject).includes(orderId))
        const token = tokenOf(mail?.body)
        const other = so().placed(f, shared.seller, f.accounts.a)
        const page = render(null, "Sales/CustomerOrder", {token})
        const document = op(null, "getSalesOrderDocument", {token})
        const crossed = render(null, "Sales/CustomerOrder", {token, orderId: other})
        const list = op(null, "findSalesOrders", {})
        shared.orderId = orderId
        shared.token = token
        return {orderId, token, page, document, crossed, list}
    },
    then({orderId, token, page, document, crossed, list}) {
        token != null
        page.includes("Order " + orderId) && page.includes("PO-SOS-1") && page.includes("Nothing has shipped yet")
        page.includes("Download the order confirmation (PDF)")
        !page.includes("<form") && !page.includes("Pay") && !page.includes("Request cancellation")
        document.file.mimeType === "application/pdf"
        crossed.includes("This order is not available") && !crossed.includes("PO-SOS-1")
        list.kind === "AuthenticationRequired"
    }
})
feature("a contact follows the shipped order under My orders, its tracking, and opens its invoice in Billing", {
    when() {
        const shipped = so().shipAndInvoice(f, shared.orderId, "SOS-TRACK-1")
        const list = op("pass_sos_buyer", "findSalesOrders", {})
        const listPage = render("pass_sos_buyer", "Sales/CustomerOrders", {})
        const page = render("pass_sos_buyer", "Sales/CustomerOrder", {orderId: shared.orderId})
        const view = op("pass_sos_buyer", "getSalesOrder", {orderId: shared.orderId})
        const invoice = render("pass_sos_buyer", "Billing/InvoicePay", {invoiceId: shipped.invoiceId})
        const hub = op("pass_sos_buyer", "getAccountHub", {})
        const bearerView = op(null, "getSalesOrder", {token: shared.token})
        return {shipped, list, listPage, page, view, invoice, hub, bearerView}
    },
    then({shipped, list, listPage, page, view, invoice, hub, bearerView}) {
        list.orderList.some(
            row => row.orderId === shared.orderId && row.deliveryText === "Shipped" && row.billingText.startsWith("Open")
        )
        listPage.includes("Order " + shared.orderId)
        page.includes("SOS-TRACK-1") && page.includes("https://carrier.example.test/track/SOS-TRACK-1")
        page.includes("Invoice " + shipped.invoiceId) && page.includes("Open in Billing")
        !page.includes("<form")
        view.invoices[0].billingUrl.endsWith("/billing/InvoicePay?invoiceId=" + shipped.invoiceId)
        // opened, not refused: the refusal is "This page is not available" (a Billing invoice with no gateway says its online
        // payment is not available)
        invoice.includes("Invoice " + shipped.invoiceId) && !invoice.includes("This page is not available")
        hub.cards.some(card => card.app === "sales" && card.lines.some(line => line.includes("open order")))
        bearerView.invoices[0].billingUrl == null && bearerView.shipments[0].tracking[0].code === "SOS-TRACK-1"
    }
})
feature("no changed ID, quote link or other account shows another customer's order", {
    when() {
        const other = sq().customer(f, "PASS_SOS_OTHER", "Other Order Co")
        const otherOrder = so().placed(f, shared.seller, other)
        const otherToken = so().link(f, otherOrder, other, ("PASS_SOS_OTHER_LINK" + "0".repeat(48)).slice(0, 48))
        const quote = sq().issued(f, f.accounts.a, f.contacts.mailed)
        const quoteToken = sq().link(quote, ("PASS_SOS_QUOTE_LINK" + "0".repeat(48)).slice(0, 48))
        sq().account("pass_sos_stranger", "stranger@orders.example.test", null, null)
        return {
            changedId: op(null, "getSalesOrder", {token: shared.token, orderId: otherOrder}),
            otherLinkOwnId: op(null, "getSalesOrder", {token: otherToken, orderId: shared.orderId}),
            byQuoteLink: op(null, "getSalesOrder", {token: quoteToken}),
            contactOther: op("pass_sos_buyer", "getSalesOrder", {orderId: otherOrder}),
            contactList: op("pass_sos_buyer", "findSalesOrders", {}),
            stranger: op("pass_sos_stranger", "findSalesOrders", {}),
            strangerOwn: op("pass_sos_stranger", "getSalesOrder", {orderId: shared.orderId}),
            otherOrder
        }
    },
    then({changedId, otherLinkOwnId, byQuoteLink, contactOther, contactList, stranger, strangerOwn, otherOrder}) {
        changedId.kind === "NotFound"
        otherLinkOwnId.kind === "NotFound"
        byQuoteLink.kind === "NotFound"
        contactOther.kind === "NotFound"
        !contactList.orderList.some(row => row.orderId === otherOrder)
        stranger.count === 0 && strangerOwn.kind === "NotFound"
    }
})
