// PASS Marketing's SubmitForm over HTTP (IronStone impl-marketing P12; design-marketing §16.3 scenario 11, its form half), on
// MarketingFormFixtures' PASS_HTTP data, with plain requests: an anonymous visitor answers the open survey and ticks the separate
// subscription choice, which files a pending request with its own verification message and never subscribes by the answer; an invited
// recipient's link read by a mail scanner changes nothing, the recipient answers once and a second answer keeps nothing; a draft or
// closed publication and a forged link show the same "not available". The records are read as john.doe over the authority's entity
// REST (params.authority, else this server).
const BASE = server.url.replace(/\/$/, "")
const AUTHORITY = String(params.authority || BASE).replace(/\/$/, "")
const PREFIX = "PASS_HTTP_MF"
const TOKEN = PREFIX + "_INVITE" + "0".repeat(26)
const operationId = () => "op" + Date.now() + Math.floor(Math.random() * 1e6)
const admin = () => session({user: "john.doe"})
const read = (who, entity, values) => who.get(AUTHORITY + "/rest/e1/" + entity, {params: values, accept: "json"}).json()
const publicationOf = (who, description) =>
    read(who, "mantle.party.FormPublication", {organizationPartyId: "PASS_HTTP_MK_ORG", description})[0]?.publicationId
feature(
    "an anonymous visitor answers the open survey with the separate subscription choice, filed pending with its own message",
    {
        when() {
            const records = admin()
            const open = publicationOf(records, "Open survey")
            const visitor = session()
            const page = visitor.get(BASE + "/marketing/SubmitForm?publication=" + open)
            const before = read(records, "mantle.party.FormSubmission", {publicationId: open}).length
            const sent = visitor.post(BASE + "/marketing/SubmitForm/submit", {
                form: {
                    publication: open,
                    fieldNames: "rating,comment",
                    f_rating: "good",
                    f_comment: "Lovely garden",
                    subscribe: "Y",
                    subscriptionEmail: "visitor.mf@example.test",
                    operationId: operationId()
                },
                follow: true
            })
            const after = read(records, "mantle.party.FormSubmission", {publicationId: open}).length
            const requests = waitUntil(
                () => {
                    const found = read(records, "mantle.marketing.contact.SubscriptionRequest", {
                        contactListId: "PASS_HTTP_MK_GARDEN",
                        orderByField: "-evidenceDate"
                    })
                    return found.length ? found : null
                },
                {timeout: 20}
            )
            return {page: page.text, sent: sent.text, before, after, request: requests[0]}
        },
        then(r) {
            r.page.includes('id="PublicForm"') && r.page.includes('name="f_rating"') && r.page.includes('id="FormSubscription"')
            r.sent.includes('id="FormReceipt"') && r.sent.includes("Thank you for telling us.")
            r.after === r.before + 1
            r.request.statusEnumId === "SrsPending"
        }
    }
)
feature(
    "an invited recipient's link: a scanner changes nothing, the recipient answers once; draft, closed and forged not available",
    {
        when() {
            const records = admin()
            const invited = PREFIX + "_INVITED"
            const scanner = session().get(BASE + "/marketing/SubmitForm?token=" + TOKEN)
            const afterScan = read(records, "mantle.party.FormSubmission", {publicationId: invited}).length
            const recipient = session()
            const first = recipient.post(BASE + "/marketing/SubmitForm/submit", {
                form: {token: TOKEN, fieldNames: "rating", f_rating: "good", operationId: operationId()},
                follow: true
            })
            const second = recipient.post(BASE + "/marketing/SubmitForm/submit", {
                form: {token: TOKEN, fieldNames: "rating", f_rating: "poor", operationId: operationId()},
                follow: true
            })
            const page = recipient.get(BASE + "/marketing/SubmitForm?token=" + TOKEN)
            const kept = read(records, "mantle.party.FormSubmission", {publicationId: invited})
            const visitor = session()
            return {
                scanner: scanner.text,
                afterScan,
                first: first.text,
                second: second.text,
                page: page.text,
                kept,
                draft: visitor.get(BASE + "/marketing/SubmitForm?publication=" + publicationOf(records, "Draft survey")).text,
                closed: visitor.get(BASE + "/marketing/SubmitForm?publication=" + publicationOf(records, "Closed survey")).text,
                forged: visitor.get(BASE + "/marketing/SubmitForm?token=" + "z".repeat(48)).text
            }
        },
        then(r) {
            r.scanner.includes('id="PublicForm"') && r.afterScan === 0
            r.first.includes("Thank you for answering.") && r.second.includes("Thank you for answering.")
            r.page.includes('id="FormReceipt"') && !r.page.includes('id="PublicForm"')
            r.kept.length === 1 && r.kept[0].partyId === "PASS_HTTP_MK_WALKER"
            ;[r.draft, r.closed, r.forged].every(text => text.includes("This form is not available"))
        }
    }
)
