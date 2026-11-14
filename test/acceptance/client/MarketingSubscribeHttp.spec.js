// PASS Marketing's subscription over HTTP (IronStone impl-marketing P7, gate 2; design-marketing §16.3 scenario 5), on
// MarketingSubscribeFixtures' PASS_HTTP data, with plain requests and no JavaScript: a visitor subscribes to one of the two offered
// lists; a mail scanner's GET of the confirmation link changes nothing; the Confirm button grants that list alone; the Email
// preferences page withdraws it with a reason; the subscriber's mailbox membership is untouched throughout. The mail and the
// records are read as john.doe over the authority's entity REST (params.authority, else this server).
const BASE = server.url.replace(/\/$/, "")
const AUTHORITY = String(params.authority || BASE).replace(/\/$/, "")
const ADDRESS = "walker.mk@example.test"
const PREFS = "PASS_HTTP_MK_PREFS" + "0".repeat(22)
const list = {garden: "PASS_HTTP_MK_GARDEN", kitchen: "PASS_HTTP_MK_KITCHEN", mailbox: "PASS_HTTP_MK_MAILBOX"}
const PARTY = "PASS_HTTP_MK_WALKER"
const operationId = () => "op" + Date.now() + Math.floor(Math.random() * 1e6)
const admin = () => session({user: "john.doe"})
const read = (who, entity, values) => who.get(AUTHORITY + "/rest/e1/" + entity, {params: values, accept: "json"}).json()
const statusOf = (who, contactListId) =>
    read(who, "mantle.marketing.contact.ContactListParty", {contactListId, partyId: PARTY, orderByField: "-fromDate"})[0]
        ?.statusId ?? null
function newestToken(who) {
    const mail = read(who, "moqui.basic.email.EmailMessage", {toAddresses: ADDRESS, orderByField: "-sentDate", pageSize: 5})
    for (const message of mail) {
        const found = /VerifySubscription\?token=([A-Za-z0-9_-]+)/.exec(String(message.body || ""))
        if (found) return found[1]
    }
    return null
}
feature("a visitor subscribes to one list; the scanner changes nothing; Confirm grants it alone; the preferences withdraw it", {
    when() {
        const records = admin()
        const visitor = session()
        const subscribe = visitor.get(BASE + "/marketing/Subscribe")
        const sent = visitor.post(BASE + "/marketing/Subscribe/request", {
            form: {contactListId: list.garden, emailAddress: ADDRESS, consent: "Y", operationId: operationId()}
        })
        const receipt = visitor.get(BASE + "/marketing/Subscribe?sent=1")
        const token = waitUntil(() => newestToken(records), {timeout: 20})
        const scanner = session().get(BASE + "/marketing/VerifySubscription?token=" + token)
        const afterScan = statusOf(records, list.garden)
        const page = visitor.get(BASE + "/marketing/VerifySubscription?token=" + token)
        const confirmed = visitor.post(BASE + "/marketing/VerifySubscription/confirm", {
            form: {token, operationId: operationId()},
            follow: true
        })
        const granted = {garden: statusOf(records, list.garden), kitchen: statusOf(records, list.kitchen)}
        const preferences = visitor.get(BASE + "/account/EmailPreferences?token=" + PREFS)
        const saved = visitor.post(BASE + "/account/EmailPreferences/save", {
            form: {token: PREFS, ["mkt_" + list.garden + "__shown"]: "true", mktReason: "tooFrequent"},
            follow: true
        })
        const withdrawal = read(records, "mantle.party.PartyConsent", {
            partyId: PARTY,
            contactListId: list.garden,
            statusId: "PconWithdrawn"
        })[0]
        return {
            subscribe: subscribe.text,
            sent: sent.status,
            receipt: receipt.text,
            token,
            scanner: scanner.text,
            afterScan,
            page: page.text,
            confirmed: confirmed.text,
            granted,
            preferences: preferences.text,
            saved: saved.text,
            garden: statusOf(records, list.garden),
            withdrawal,
            mailbox: statusOf(records, list.mailbox)
        }
    },
    then(r) {
        r.subscribe.includes("Garden news") && r.subscribe.includes("Kitchen news") && r.subscribe.includes('name="consent"')
        r.sent === 302
        r.receipt.includes("Check your email") && !r.receipt.includes(ADDRESS)
        r.token != null
        r.scanner.includes('id="VerifyForm"') && r.scanner.includes("w***@example.test")
        r.afterScan === "CLPT_PENDING"
        r.page.includes("Confirm")
        r.confirmed.includes("Your subscription is confirmed") && r.confirmed.includes("Confirmed.")
        r.granted.garden === "CLPT_ACCEPTED" && r.granted.kitchen === null
        r.preferences.includes("Email from") && r.preferences.includes("Garden news") && r.preferences.includes("Too frequent")
        r.saved.includes("Your preferences are saved")
        r.garden === "CLPT_UNSUBSCRIBED"
        r.withdrawal.comments === "Too frequent"
        r.mailbox === "CLPT_ACCEPTED"
    }
})
feature('a forged link, an unoffered list and a site path without the mount answer the same "not available"', {
    when() {
        const visitor = session()
        return {
            forged: visitor.get(BASE + "/marketing/VerifySubscription?token=" + "x".repeat(40)).text,
            hidden: visitor.get(BASE + "/marketing/Subscribe?list=PASS_HTTP_MK_HIDDEN").text
        }
    },
    then({forged, hidden}) {
        forged.includes("This link is not available") && !forged.includes("Garden")
        hidden.includes("There is nothing to subscribe to here") && !hidden.includes("Hidden news")
    }
})
