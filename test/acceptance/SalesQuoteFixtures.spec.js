// PASS Sales on the HTTP test community (PASS_HTTP, from PortalFixtures; IronStone impl-sales P13): a Sales mount for Mantle's
// quote fixture organization (SalesQuoteFixtures.js, prefix PASS_HTTP_SQ), three issued quotes with links of known tokens (the
// browser walk's, the plain requests', another customer's), and a public account invited for the quotes' account, for the walk
// SalesQuoteHttp, locally or through a remote frontend.
const sq = () => ec.resource.script("component://mr-pass/test/Sales/SalesQuoteFixtures.js")
const token = name => ("PASS_HTTP_SQ" + name + "0".repeat(48)).slice(0, 48)
spec({
    dependsOn: ["PortalFixtures"],
    setupSpec() {
        login("john.doe")
    }
})
feature("provision PASS Sales' mount, its quotes and their links, and an invited contact", {
    when() {
        const f = sq().setup("PASS_HTTP_SQ")
        sq().mount("PASS_HTTP", f.orgA, "127.0.0.1")
        const walk = sq().issued(f, f.accounts.a, f.contacts.mailed)
        const plain = sq().issued(f, f.accounts.a, f.contacts.mailed)
        const other = sq().issued(f, sq().customer(f, "PASS_HTTP_SQ_OTHER", "Other Quote Co"), null)
        sq().link(walk, token("Walk"))
        sq().link(plain, token("Plain"))
        sq().link(other, token("Other"))
        sq().account("pass_http_sq_contact", "pass_http_sq_contact@buyer.example.test", f.accounts.a, f.orgA)
        return {walk, plain, other}
    },
    then({walk, plain, other}) {
        walk.orderId != null && plain.orderId != null && other.orderId != null
    }
})
