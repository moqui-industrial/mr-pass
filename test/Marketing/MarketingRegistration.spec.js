// PASS Marketing's Register and Registration (IronStone impl-marketing P17; design-marketing §13 Register, Registration; mr-mantle
// mantle.marketing.MarketingPortalServices reserve#, complete#, start#RegistrationPayment, get# and cancel#Registration over
// EventRegistrationPlaces.js): the Register page offers the tickets; a reservation's capability reads and cancels only its own
// reservation, a forged one nothing; the answer names each place's attendee and state and never an answer, a code or anything
// internal; a client's reservations past its limit are refused and hold no seat; the five operations are in both schema copies and
// route lists and in the three TOKEN_WRITES lists alike. Follow-up 1: the answer states the cancellation rule of the accepted terms,
// and past its deadline cancelRegistration is refused (CANCELLATION_CLOSED) with nothing changed. Mantle's EventRegistrations spec
// covers the holds, payment, order, capture, refunds and entry codes.
const fx = ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
const host = "register.marketing.example.test"
let ids, offer
let firstToken = null
let keys = 0
const key = () => "PMRk" + ++keys + "x" + Math.floor(Math.random() * 1e9)
const reserve = (quantity, email) =>
    fx.call("reserveRegistration", {
        siteId: ids.siteId,
        registrationPolicyId: offer.offer,
        lines: JSON.stringify([{ticketTypeId: offer.ticket, quantity}]),
        buyerName: "Page buyer",
        buyerEmail: email,
        operationId: key()
    })
const places = () =>
    Array.from(
        ec.entity
            .find("mantle.work.registration.EventRegistration")
            .condition({registrationPolicyId: offer.offer})
            .disableAuthz()
            .list()
    )
spec({
    setupSpec() {
        ids = fx.setup("PMR", "PASS_MKT_REGISTER", host)
        offer = fx.registrations("PMR", ids)
        logout()
    },
    cleanupSpec() {
        login("john.doe")
    }
})
feature(
    "the Register page offers the tickets; a capability reads and cancels only its own reservation; the answer names nothing private",
    {
        when() {
            const page = ec.screen
                .makeTest()
                .rootScreen("component://mr-pass/screen/Pass.xml")
                .render(
                    "Marketing/Register",
                    {resolvedSiteId: ids.siteId, publicHost: host, offer: offer.offer, publicPath: "/marketing/Register"},
                    null
                )
            const first = reserve(2, "first@register.example.test")
            firstToken = first.token
            const second = reserve(1, "second@register.example.test")
            const completed = fx.call("completeRegistration", {
                siteId: ids.siteId,
                token: first.token,
                attendees: JSON.stringify([{name: "First buyer"}, {name: "Second guest", email: "guest@register.example.test"}]),
                acceptTerms: "Y",
                termsRevision: 0,
                operationId: key()
            })
            const own = fx.call("getRegistration", {siteId: ids.siteId, token: first.token})
            // the second reservation's capability names the second reservation alone; a forged one and another site nothing
            const other = fx.call("getRegistration", {siteId: ids.siteId, token: second.token})
            const forged = fx.call("getRegistration", {siteId: ids.siteId, token: "x".repeat(48)})
            const elsewhere = fx.call("getRegistration", {siteId: ids.siteNone, token: first.token})
            const wrongKey = fx.call("getRegistration", {
                siteId: ids.siteId,
                reference: first.registration.reference,
                key: "nope"
            })
            const cancelOther = fx.call("cancelRegistration", {
                siteId: ids.siteId,
                token: second.token,
                registrationIds: own.registration.places.map(place => place.registrationId),
                confirm: "Y",
                operationId: key()
            })
            const firstAfter = fx.call("getRegistration", {siteId: ids.siteId, token: first.token})
            return {page, first, second, completed, own, other, forged, elsewhere, wrongKey, cancelOther, firstAfter}
        },
        then(r) {
            r.page.errorMessages.length == 0
            r.page.output.includes('id="RegistrationChoice"') &&
                r.page.output.includes("Free place") &&
                r.page.output.includes("quantity_" + offer.ticket)
            !!r.first.token && r.first.registration.state == "held"
            !!r.second.token && r.second.registration.state == "held"
            r.completed.registration.state == "confirmed"
            r.own.registration.places.map(place => place.attendeeName + ":" + place.statusId).join() ==
                "First buyer:EvrConfirmed,Second guest:EvrConfirmed"
            r.own.registration.places.every(
                place =>
                    Object.keys(place).sort().join() ==
                    "attendeeName,canCancel,canShowCode,refundText,registrationId,stateText,statusId,ticketName"
            )
            !JSON.stringify(r.own).includes("formResponse") &&
                !JSON.stringify(r.own).includes("credential") &&
                !JSON.stringify(r.own).includes("partyId")
            r.other.registration.reference == r.second.registration.reference && r.other.registration.places.length == 1
            r.forged.kind == "NotFound" && r.elsewhere.kind == "NotFound" && r.wrongKey.kind == "NotFound"
            new Set([r.forged.error, r.elsewhere.error, r.wrongKey.error]).size == 1
            r.firstAfter.registration.state == "confirmed"
            r.cancelOther.registration.reference == r.second.registration.reference
        }
    }
)
feature(
    "the answer states the accepted terms' cancellation rule; past its deadline a cancellation is refused and changes nothing",
    {
        when() {
            const before = fx.call("getRegistration", {siteId: ids.siteId, token: firstToken})
            // the accepted revision's rule moved: cancellation closes 200 hours before the start (five days on), so it has closed
            ec.service
                .sync()
                .name("update#mantle.work.registration.EventRegistrationTerms")
                .parameters({registrationPolicyId: offer.offer, termsRevision: 0, cancelDeadlineHours: 200, refundPercent: 50})
                .disableAuthz()
                .call()
            const closed = fx.call("getRegistration", {siteId: ids.siteId, token: firstToken})
            const refused = fx.call("cancelRegistration", {
                siteId: ids.siteId,
                token: firstToken,
                confirm: "Y",
                operationId: key()
            })
            const after = fx.call("getRegistration", {siteId: ids.siteId, token: firstToken})
            return {before, closed, refused, after}
        },
        then(r) {
            r.before.registration.canCancel == true && r.before.registration.cancelRule.includes("until the event starts")
            r.closed.registration.canCancel == false && r.closed.registration.places.every(place => !place.canCancel)
            r.closed.registration.cancelRule.includes("up to 200 hours before") &&
                r.closed.registration.cancelRule.includes("50%")
            r.refused.kind == "Conflict" && r.refused.error.includes("CANCELLATION_CLOSED")
            r.after.registration.places.every(place => place.statusId == "EvrConfirmed")
        }
    }
)
feature("a client's reservations past its limit are refused alike and hold no seat", {
    when() {
        const before = places().length
        let refused = null,
            made = 0
        for (let index = 0; index < 12 && !refused; index++) {
            const out = reserve(1, "many" + index + "@register.example.test")
            if (out.kind === "Tarpit") refused = out
            else if (!out.kind) made++
        }
        return {before, after: places().length, refused, made}
    },
    then({before, after, refused, made}) {
        !!refused && refused.error.includes("Too many registrations")
        after - before == made
    }
})
feature("the operations are in both schema copies and route lists, and in the three TOKEN_WRITES lists alike", {
    when() {
        const ops = [
            "reserveRegistration",
            "completeRegistration",
            "startRegistrationPayment",
            "getRegistrationPaymentForm",
            "getRegistration",
            "cancelRegistration"
        ]
        const pass = ec.resource.script("component://mr-pass/service/pass/Schema.js")
        const mantle = ec.resource.script("component://mr-mantle/service/mantle/forum/ForumSchema.js")
        const routes = [
            ec.resource.script("component://mr-pass/service/pass/Routes.js"),
            ec.resource.script("component://mr-mantle/script/PassRoutes.js")
        ]
        const lists = [
            ec.resource.script("component://mr-pass/service/pass/Transport.js").TOKEN_WRITES,
            ec.resource.script("component://mr-mantle/script/PassApi.js").TOKEN_WRITES,
            ec.resource.script("component://mr-mantle/script/PassAuthority.js").TOKEN_WRITES
        ].map(list => Array.from(list))
        return {
            schemas: ops.every(op => !!pass[op] && JSON.stringify(pass[op]) === JSON.stringify(mantle[op])),
            routed: ops.map(op => routes.map(list => Array.from(list).find(route => route[2] === op)?.[0]).join("/")),
            written: ops.every(op => lists.every(list => list.includes(op))),
            same: lists.every(list => JSON.stringify(list) === JSON.stringify(lists[0])),
            // the relay alone may post to Accept Hosted's page (the user's call, Nov 15); Register keeps form-action 'self'
            headers: ec.resource.script("component://mr-pass/screen/Shared/Headers.js")
        }
    },
    then({schemas, routed, written, same, headers}) {
        schemas
        routed.every(verbs => verbs == "POST/POST")
        written && same
        headers.policyOf("marketing", "/RegistrationRelay", false).formAction.includes("https://accept.authorize.net")
        headers.policyOf("marketing", "/Register", false).formAction.length == 0
    }
})
