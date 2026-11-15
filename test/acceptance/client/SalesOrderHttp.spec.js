// PASS Sales' order pages over HTTP (IronStone impl-sales P17; design-sales §14.3 scenario 8, its order half), on
// SalesOrderFixtures' PASS_HTTP data: the confirmation's link opened at 390 px shows that one order with its shipment's tracking
// and its invoice's open amount and offers no form (no edit, cancel or payment); with plain requests (which run the same against
// the remote frontend of docs/Deployment.md "Reproducing the remote check"), the invited contact signs in and finds the order under
// My orders, while a forged link, another customer's link with this order's ID and another customer's order by its ID show "not
// available" and nothing of it.
const token = name => ("PASS_HTTP_SO" + name + "0".repeat(48)).slice(0, 48)
const BASE = "http://127.0.0.1:" + server.port
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
const orderId = text => (/Order ([^\s<]+)/.exec(text) || [])[1] || null
const operationId = () => "op" + Date.now() + Math.floor(Math.random() * 1e6)
feature("the confirmation's link at 390 px shows the order, its tracking and its open invoice, and no form", {
    when() {
        const page = browser.newPage({viewport: {width: 390, height: 844}})
        page.goto("/sales/CustomerOrder?token=" + token("Walk"))
        const text = page.text()
        const forms = page.evaluate(() => document.querySelectorAll("main form").length)
        const tracking = page.evaluate(() => document.querySelector("#OrderShipments a")?.getAttribute("href") || "")
        return {text, forms, tracking, overflow: overflow(page)}
    },
    then({text, forms, tracking, overflow}) {
        text.includes("PO-HTTP-SO") && text.includes("HTTP-SO-TRACK") && text.includes("Open:")
        forms === 0
        tracking === "https://carrier.example.test/track/HTTP-SO-TRACK"
        overflow === false
    }
})
feature(
    "the invited contact finds the order under My orders; a forged link, another's link and another's order are not available",
    {
        when() {
            const visitor = session()
            const forged = visitor.get(BASE + "/sales/CustomerOrder?token=" + "x".repeat(48)).text
            const walkPage = visitor.get(BASE + "/sales/CustomerOrder?token=" + token("Walk")).text
            const walkId = orderId(walkPage)
            const otherLink = visitor.get(
                BASE + "/sales/CustomerOrder?token=" + token("Other") + "&orderId=" + encodeURIComponent(walkId)
            ).text
            const otherPage = visitor.get(BASE + "/sales/CustomerOrder?token=" + token("Other")).text
            const otherId = orderId(otherPage)
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
            const list = contact.get(BASE + "/sales/CustomerOrders").text
            const own = contact.get(BASE + "/sales/CustomerOrder?orderId=" + encodeURIComponent(walkId)).text
            const others = contact.get(BASE + "/sales/CustomerOrder?orderId=" + encodeURIComponent(otherId)).text
            return {forged, walkId, otherLink, otherId, list, own, others}
        },
        then({forged, walkId, otherLink, otherId, list, own, others}) {
            forged.includes("This order is not available")
            walkId != null && otherId != null && walkId !== otherId
            otherLink.includes("This order is not available") && !otherLink.includes("Other Order Co")
            list.includes("Order " + walkId) && !list.includes("Order " + otherId)
            own.includes("HTTP-SO-TRACK")
            others.includes("This order is not available") && !others.includes("Other Order Co")
        }
    }
)
