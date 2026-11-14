// PASS Sales' quote scenarios (IronStone impl-sales P13, gate 2; design-sales §14.3 scenarios 7 and 8, §10): the customer's
// mailed link reads the offer and its PDF, accepts with a PO and gets the receipt, a second submit and a second open showing the
// same receipt and one placed order, which staff see as the customer's own response; the rep invites a contact of the account
// (Invite to Sales), the contact redeems it, signs in and finds the quote under My quotes and on the Account hub; no changed ID,
// other link or other account shows another customer's quote, a revised quote's link opens nothing, and above the seller's
// threshold the link alone cannot accept while the signed-in contact can. Through pass.Facade (the local authority) and the
// pages' renders; standalone (SalesQuoteFixtures). The browser walk and the remote frontend are SalesQuoteHttp.
// Run: ./moq accept mr-pass --spec SalesQuoteScenarios
const sq = () => ec.resource.script("component://mr-pass/test/Sales/SalesQuoteFixtures.js")
const capture = ec.factory.getTool("MailCapture")
const siteId = "PASS_SALES_SCN"
const host = "quotes.example.test"
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
        const rendered = ec.screen
            .makeTest()
            .rootScreen("component://mr-pass/screen/Pass.xml")
            .render(
                path,
                {resolvedSiteId: siteId, publicHost: host, publicPath: "/" + path.replace(/^Sales/, "sales"), ...parameters},
                null
            )
        return rendered.output
    } finally {
        login("john.doe")
    }
}
const tokenOf = body => {
    const found = /\/sales\/CustomerQuote\?token=([^"'\s<&]+)/.exec(String(body || ""))
    return found ? decodeURIComponent(found[1]) : null
}
const operationId = () => "scn" + Date.now() + Math.floor(Math.random() * 1e6)
spec({
    stepwise: true,
    setupSpec() {
        capture.enable()
        f = sq().setup("PASS_SQS")
        sq().mount(siteId, f.orgA, host)
    },
    cleanupSpec() {
        capture.reset()
        login("john.doe")
    }
})
feature(
    "the mailed link reads the offer and its PDF, accepts with a PO and shows the receipt; a second click shows the same receipt",
    {
        when() {
            capture.clear()
            const quote = sq().issued(f, f.accounts.a, f.contacts.mailed)
            const token = tokenOf(capture.getMessages()[0]?.body)
            const offer = render(null, "Sales/CustomerQuote", {token})
            const document = op(null, "getSalesQuoteDocument", {token})
            const accept = {
                token,
                action: "accept",
                expectedRevision: quote.revision,
                acknowledge: "Y",
                purchaseOrder: "PO-4410",
                acceptorName: "Ann Buyer",
                acceptorTitle: "Buyer",
                operationId: operationId()
            }
            const first = op(null, "respondSalesQuote", accept)
            const again = op(null, "respondSalesQuote", accept)
            const receipt = render(null, "Sales/QuoteResponse", {token})
            const receiptAgain = render(null, "Sales/QuoteResponse", {token})
            const staff = sq().fx().as(f.users.rep, "get#QuoteIssues", {orderId: quote.orderId})
            shared.quote = quote
            shared.token = token
            return {
                quote,
                token,
                offer,
                document,
                first,
                again,
                receipt,
                receiptAgain,
                staff,
                statusId: sq().fx().status(quote.orderId)
            }
        },
        then({quote, token, offer, document, first, again, receipt, receiptAgain, staff, statusId}) {
            token != null
            offer.includes("Quote " + quote.orderId) &&
                offer.includes('id="AcceptQuote"') &&
                offer.includes("Download the quote (PDF)")
            document.file.mimeType === "application/pdf"
            first.alreadyApplied === false && first.response.outcome === "placed"
            again.alreadyApplied === true && again.response.responseId === first.response.responseId
            receipt.includes("Quote accepted") && receipt.includes("PO-4410") && receipt.includes("Ann Buyer")
            receiptAgain.includes("Quote accepted") && receiptAgain.includes(first.response.orderId)
            statusId === "OrderPlaced"
            staff.issues[0].state === "accepted"
        }
    }
)
feature(
    "the rep invites a contact of the account, who redeems it, signs in and finds the quote under My quotes and on the Account hub",
    {
        when() {
            const email = "pass_sqs_mailed@issue.example.test"
            const invited = sq().fx().as(f.users.inviter, "mantle.sales.AccountServices.invite#SalesContact", {
                accountPartyId: f.accounts.a,
                contactPartyId: f.contacts.mailed,
                emailAddress: email
            })
            sq().account("pass_sqs_buyer", email, null, null)
            login("pass_sqs_buyer", "moqui")
            const redeemed = ec.service
                .sync()
                .name("mantle.public.SiteServices.redeem#Invitation")
                .parameters({
                    input: {
                        siteId,
                        token: invited.invitationUrl ? decodeURIComponent(/token=([^&]+)/.exec(invited.invitationUrl)[1]) : null
                    }
                })
                .call()?.result
            login("john.doe")
            const list = op("pass_sqs_buyer", "findSalesQuotes", {})
            const hub = op("pass_sqs_buyer", "getAccountHub", {})
            const page = render("pass_sqs_buyer", "Sales/CustomerQuote", {orderId: shared.quote.orderId})
            return {invited, redeemed, list, hub, page}
        },
        then({invited, redeemed, list, hub, page}) {
            invited.refused === "" && invited.invitationUrl.includes("/account/Invitation?token=")
            redeemed.state === "active"
            list.quoteList.some(row => row.orderId === shared.quote.orderId && row.state === "accepted")
            hub.cards.some(card => card.app === "sales" && card.title === "Quotes and orders")
            page.includes("Quote " + shared.quote.orderId) && page.includes("See the receipt")
        }
    }
)
feature(
    "no changed ID, other link or other account shows another customer's quote; a revised link opens nothing; above the threshold the link cannot accept",
    {
        when() {
            const other = sq().customer(f, "PASS_SQS_OTHER", "Other Customer Co")
            const otherQuote = sq().issued(f, other, null)
            const otherToken = sq().link(otherQuote, ("PASS_SQS_OTHER_LINK" + "0".repeat(48)).slice(0, 48))
            const changedId = op(null, "getSalesQuote", {token: shared.token, orderId: otherQuote.orderId})
            const otherLinkOwnId = op(null, "getSalesQuote", {token: otherToken, orderId: shared.quote.orderId})
            const contactOther = op("pass_sqs_buyer", "getSalesQuote", {orderId: otherQuote.orderId})
            sq().account("pass_sqs_stranger", "stranger@quotes.example.test", null, null)
            const stranger = op("pass_sqs_stranger", "findSalesQuotes", {})
            capture.clear()
            const revisedQuote = sq().issued(f, f.accounts.a, f.contacts.mailed)
            const revisedToken = tokenOf(capture.getMessages()[0]?.body)
            sq()
                .fx()
                .as(f.users.rep, "revise#Quote", {
                    orderId: revisedQuote.orderId,
                    orderRevision: revisedQuote.revision,
                    reason: "New terms"
                })
            const revised = op(null, "getSalesQuote", {token: revisedToken})
            sq().threshold(f, 300)
            capture.clear()
            const high = sq().issued(f, f.accounts.a, f.contacts.mailed, 5)
            const highToken = tokenOf(capture.getMessages()[0]?.body)
            const accept = more => ({
                action: "accept",
                expectedRevision: high.revision,
                acknowledge: "Y",
                purchaseOrder: "PO-HIGH",
                acceptorName: "Ann Buyer",
                operationId: operationId(),
                ...more
            })
            const bearer = op(null, "respondSalesQuote", accept({token: highToken}))
            const signedIn = op("pass_sqs_buyer", "respondSalesQuote", accept({orderId: high.orderId}))
            return {changedId, otherLinkOwnId, contactOther, stranger, revised, bearer, signedIn}
        },
        then({changedId, otherLinkOwnId, contactOther, stranger, revised, bearer, signedIn}) {
            changedId.kind === "NotFound"
            otherLinkOwnId.kind === "NotFound"
            contactOther.kind === "NotFound"
            stranger.count === 0
            revised.kind === "NotFound"
            bearer.kind === "Unprocessable" && /ACCEPTANCE_SIGN_IN_REQUIRED|acceptanceSignInRequired/.test(bearer.error)
            signedIn.response.accepted === true
        }
    }
)
