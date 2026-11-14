// PASS Sales' orders on the HTTP test community (PASS_HTTP; IronStone impl-sales P17), after SalesQuoteFixtures, whose Sales mount
// serves Mantle's quote fixture organization (prefix PASS_HTTP_SQ): a seller, a direct order of account a shipped with a tracked
// package and invoiced, with an order link of a known token, another customer's order with its own link, and the invited contact
// of SalesQuoteFixtures (pass_http_sq_contact), for the walk SalesOrderHttp, locally or through a remote frontend. PASS_HTTP's
// Billing serves another organization, so the walk's invoice has no Billing link (SalesOrderScenarios opens one).
const sq = () => ec.resource.script("component://mr-pass/test/Sales/SalesQuoteFixtures.js")
const so = () => ec.resource.script("component://mr-pass/test/Sales/SalesOrderFixtures.js")
const token = name => ("PASS_HTTP_SO" + name + "0".repeat(48)).slice(0, 48)
spec({
    dependsOn: ["SalesQuoteFixtures"],
    setupSpec() {
        login("john.doe")
    }
})
feature("provision PASS Sales' orders, their links and their shipment and invoice", {
    when() {
        // the quote fixtures' ids (SalesQuoteIssueFixtures.setup("PASS_HTTP_SQ")), a seller added under the same prefix
        const f = {
            prefix: "PASS_HTTP_SQ",
            orgA: "PASS_HTTP_SQ_ORG_A",
            product: "PASS_HTTP_SQ_PRICED",
            template: "PASS_HTTP_SQ_QUOTE_MAIL",
            accounts: {a: "PASS_HTTP_SQ_ACC_A"},
            contacts: {mailed: "PASS_HTTP_SQ_MAILED"}
        }
        const seller = so().seller(f)
        const walk = so().placed(f, seller, f.accounts.a, {otherPartyOrderId: "PO-HTTP-SO"})
        so().shipAndInvoice(f, walk, "HTTP-SO-TRACK")
        so().link(f, walk, f.accounts.a, token("Walk"))
        const otherCustomer = sq().customer(f, "PASS_HTTP_SO_OTHER", "Other Order Co")
        const other = so().placed(f, seller, otherCustomer)
        so().link(f, other, otherCustomer, token("Other"))
        return {walk, other}
    },
    then({walk, other}) {
        walk != null && other != null
    }
})
