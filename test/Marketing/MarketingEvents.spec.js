// PASS Marketing's Event page (IronStone impl-marketing P16; design-marketing §13 Event; mr-mantle
// mantle.marketing.MarketingPortalServices get#Event over EventRegistrations.js publicView): a published registration offer shows its
// title, description (as text), dates in its zone, where or that it is online, ticket prices from the product and advisory availability
// and its terms, and nothing internal (the event's own name and notes, its call link, its people); a draft, closed, past or another
// site's offer and an unknown id are not available alike. The operation is in both schema copies and route lists, a read in no
// TOKEN_WRITES list. Mantle's EventRegistrationSetup spec covers the staff services and readiness.
const fx = ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
const host = "events.marketing.example.test"
let ids, offers
const render = (path, parameters) => {
    const rendered = ec.screen
        .makeTest()
        .rootScreen("component://mr-pass/screen/Pass.xml")
        .render(path, {resolvedSiteId: ids.siteId, publicHost: host, ...parameters}, null)
    return {html: rendered.output, errors: rendered.errorMessages}
}
spec({
    setupSpec() {
        ids = fx.setup("PME", "PASS_MKT_EVENTS", host)
        offers = fx.events("PME", ids)
        logout()
    },
    cleanupSpec() {
        login("john.doe")
    }
})
feature(
    "a published offer's page shows its offer and nothing internal; a draft, closed, past or another site's offer is not available",
    {
        when() {
            const page = render("Marketing/Event", {offer: offers.published, publicPath: "/marketing/Event"})
            const answer = fx.call("getMarketingEvent", {siteId: ids.siteId, registrationPolicyId: offers.published})
            const misses = [
                fx.call("getMarketingEvent", {siteId: ids.siteId, registrationPolicyId: offers.draft}),
                fx.call("getMarketingEvent", {siteId: ids.siteId, registrationPolicyId: offers.closed}),
                fx.call("getMarketingEvent", {siteId: ids.siteId, registrationPolicyId: offers.past}),
                fx.call("getMarketingEvent", {siteId: ids.siteId, registrationPolicyId: offers.otherSite}),
                fx.call("getMarketingEvent", {siteId: ids.siteNone, registrationPolicyId: offers.published}),
                fx.call("getMarketingEvent", {siteId: ids.siteId, registrationPolicyId: "NO_SUCH_OFFER"})
            ]
            return {page, answer, misses}
        },
        then({page, answer, misses}) {
            page.errors.length === 0
            page.html.includes('id="PublicEvent"') && page.html.includes("Pruning workshop") && page.html.includes("Garden hall")
            page.html.includes("Bring gloves.") &&
                page.html.includes("&lt;b&gt;roses&lt;/b&gt;") &&
                !page.html.includes("<b>roses</b>")
            page.html.includes("Standard") &&
                page.html.includes("$25.00") &&
                page.html.includes("Guest") &&
                page.html.includes("Full: join the waitlist")
            page.html.includes("Registered attendees receive the link to join")
            page.html.includes("Cancel up to a day before.") && page.html.includes("Registration is open until")
            // nothing internal: the event's own name and notes, its call link, the organization's ids
            !page.html.includes("internal name") && !page.html.includes("budget 900") && !page.html.includes("call.example.test")
            Object.keys(answer.event).sort().join() ===
                "availability,cancellationTerms,description,endText,location,online,organizationName,registrationOpen,registrationPolicyId,registrationText,startText,terms,tickets,timeZone,title"
            answer.event.tickets.map(ticket => ticket.name + ": " + ticket.availability).join(", ") ===
                "Standard: Places available, Guest: Full: join the waitlist"
            misses.every(miss => miss.kind === "NotFound")
            new Set(misses.map(miss => miss.error)).size === 1
        }
    }
)
feature("the operation is in both schema copies and route lists, and is a read in no TOKEN_WRITES list", {
    when() {
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
        ]
        return {
            inSchemas:
                !!pass.getMarketingEvent && JSON.stringify(pass.getMarketingEvent) === JSON.stringify(mantle.getMarketingEvent),
            routed: routes.map(list => Array.from(list).find(route => route[2] === "getMarketingEvent")?.[0]),
            written: lists.some(list => Array.from(list).includes("getMarketingEvent"))
        }
    },
    then({inSchemas, routed, written}) {
        inSchemas
        routed.join() === "GET,GET"
        !written
    }
})
