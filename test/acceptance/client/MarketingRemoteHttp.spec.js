// PASS Marketing through a remote frontend (IronStone impl-marketing P7, gate 2): run against the remote frontend of
// docs/Deployment.md "Reproducing the remote check" (its authority serving MarketingSubscribeFixtures, the frontend loading only
// framework, webroot and PASS), with params.authority the authority's URL for the mail and records: the same walk as
// MarketingSubscribeHttp, every page answered over the authority connection (the request an anonymous write the transport lets
// through, the confirmation a bearer write of the registered deployment). A second address is used, so it runs after the local
// walk on the same authority. Against `./moq accept mr-pass`'s served server (a local authority) it checks the same pages.
const BASE = server.url.replace(/\/$/, "")
const AUTHORITY = String(params.authority || BASE).replace(/\/$/, "")
const ADDRESS = "remote." + Date.now().toString(36) + "@example.test"
const list = {garden: "PASS_HTTP_MK_GARDEN", kitchen: "PASS_HTTP_MK_KITCHEN"}
const operationId = () => "op" + Date.now() + Math.floor(Math.random() * 1e6)
const read = (who, entity, values) => who.get(AUTHORITY + "/rest/e1/" + entity, {params: values, accept: "json"}).json()
feature("through the remote frontend a visitor subscribes to one list, a GET changes nothing, and Confirm grants it alone", {
    when() {
        const records = session({user: "john.doe"})
        const visitor = session()
        const subscribe = visitor.get(BASE + "/marketing/Subscribe")
        const sent = visitor.post(BASE + "/marketing/Subscribe/request", {
            form: {contactListId: list.kitchen, emailAddress: ADDRESS, consent: "Y", operationId: operationId()}
        })
        const token = waitUntil(
            () => {
                const mail = read(records, "moqui.basic.email.EmailMessage", {toAddresses: ADDRESS, orderByField: "-sentDate"})
                return mail.map(m => /VerifySubscription\?token=([A-Za-z0-9_-]+)/.exec(String(m.body || ""))?.[1]).find(Boolean)
            },
            {timeout: 20}
        )
        const party = read(records, "mantle.party.contact.PartyContactMechInfo", {infoString: ADDRESS})[0]?.partyId
        const statusOf = contactListId =>
            read(records, "mantle.marketing.contact.ContactListParty", {contactListId, partyId: party})[0]?.statusId ?? null
        const scanner = session().get(BASE + "/marketing/VerifySubscription?token=" + token)
        const afterScan = statusOf(list.kitchen)
        const confirmed = visitor.post(BASE + "/marketing/VerifySubscription/confirm", {
            form: {token, operationId: operationId()},
            follow: true
        })
        return {
            subscribe: subscribe.text,
            sent: sent.status,
            scanner: scanner.text,
            afterScan,
            confirmed: confirmed.text,
            kitchen: statusOf(list.kitchen),
            garden: statusOf(list.garden)
        }
    },
    then(r) {
        r.subscribe.includes("Kitchen news")
        r.sent === 302
        r.scanner.includes('id="VerifyForm"')
        r.afterScan === "CLPT_PENDING"
        r.confirmed.includes("Your subscription is confirmed")
        r.kitchen === "CLPT_ACCEPTED" && r.garden === null
    }
})
