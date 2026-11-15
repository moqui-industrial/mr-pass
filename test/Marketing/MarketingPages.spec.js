// PASS Marketing's landing pages (IronStone impl-marketing P14; design-marketing §8 LandingPages, §13.1; mr-mantle
// mantle.marketing.MarketingPortalServices get#Page over the site page services' marketing mount): a published landing page of the
// site's marketing mount is served at pages/{route} with no store, its text sanitized (no script or event handler) and its
// embedded subscribe box shown for a list the site offers only; a draft page, an unknown route and a site without the mount are
// not available alike. The operation is in both schema copies and route lists, a read (in no TOKEN_WRITES list). Mantle's
// SitePages spec covers the storeless mount's staff rules; the acceptance test MarketingPagesHttp goes through a visitor's
// subscription from the page. P15: a tracking link's code on the page's address (?tc=) records one page visit.
const fx = ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
const host = "landing.marketing.example.test"
let ids
const render = (path, parameters) => {
    const rendered = ec.screen
        .makeTest()
        .rootScreen("component://mr-pass/screen/Pass.xml")
        .render(path, {resolvedSiteId: ids.siteId, publicHost: host, ...parameters}, null)
    return {html: rendered.output, errors: rendered.errorMessages}
}
spec({
    setupSpec() {
        ids = fx.setup("PMP", "PASS_MKT_LANDING", host)
        Object.assign(
            ids,
            fx.pages(
                ids,
                [
                    "# Spring in the garden",
                    "",
                    "Plant now. <script>alert('x')</script><img src=x onerror=alert(1)>",
                    "",
                    '[Tap](javascript:alert(2)) <a href="data:text/html,<b>x</b>">Data</a> <svg onload="alert(3)"><circle r="1"/></svg>',
                    '<div style="background:url(javascript:alert(4))">Styled</div>',
                    "",
                    "[[subscribe " + ids.garden + "]]",
                    "",
                    "[[subscribe " + ids.hidden + "]]",
                    "",
                    "[[form NO_SUCH_FORM]]"
                ].join("\n")
            )
        )
        // P15: a tracking link of the site, whose code on the page's address records a page visit
        const {make, system, row} = fx.lib
        if (!row("mantle.marketing.tracking.TrackingCode", {trackingCodeId: "PMP_LINK"}))
            system(() =>
                make("mantle.marketing.tracking.TrackingCode", {
                    trackingCodeId: "PMP_LINK",
                    organizationPartyId: ids.org,
                    siteId: ids.siteId,
                    publicCode: "PmpPage0001",
                    destinationKindEnumId: "TdkUrl",
                    redirectUrl: "https://" + host + "/marketing/pages/spring",
                    disabled: "N",
                    fromDate: new Date(Date.now() - 86400000)
                })
            )
        logout()
    },
    cleanupSpec() {
        login("john.doe")
    }
})
feature("a published landing page is served with no store, its subscribe box for an offered list only; others not available", {
    when() {
        const page = render("Marketing/Page", {routePath: "spring", publicPath: "/marketing/pages/spring", tc: "PmpPage0001"})
        const visits = Array.from(
            ec.entity
                .find("mantle.marketing.tracking.MarketingTrackingEvent")
                .condition({trackingCodeId: "PMP_LINK"})
                .disableAuthz()
                .list()
        )
        const route = ec.service
            .sync()
            .name("pass.RouteServices.resolve#Route")
            .parameters({siteId: ids.siteId, hostname: host, path: "/marketing/pages/spring"})
            .call()
        return {
            page,
            route,
            draft: fx.call("getMarketingPage", {siteId: ids.siteId, routePath: "summer"}),
            unknown: fx.call("getMarketingPage", {siteId: ids.siteId, routePath: "no-such-page"}),
            noMount: fx.call("getMarketingPage", {siteId: ids.siteNone, routePath: "spring"}),
            published: fx.call("getMarketingPage", {siteId: ids.siteId, routePath: "spring"}),
            visits
        }
    },
    then({page, route, draft, unknown, noMount, published, visits}) {
        page.errors.length === 0
        // P15: the tracking code on the address recorded one page visit, with no key (the page sets none) and no party; the spec's
        // render sends no browser's user agent, so it is marked a known automated fetch
        visits.length === 1 && visits[0].eventKindEnumId === "MteVisit" && visits[0].automated === "Y"
        !visits[0].visitorKeyHash && !visits[0].campaignRecipientId
        page.html.includes('id="LandingPage"') && page.html.includes("Spring sale") && page.html.includes("Plant now.")
        !page.html.includes("<script>alert") && !page.html.includes("onerror")
        // the page's own article: no script URL, data URL, SVG or style from its text
        ;(article => !/javascript:|data:text|<svg|onload|style=/i.test(article) && article.includes("Tap"))(
            page.html.slice(
                page.html.indexOf('id="LandingPage"'),
                page.html.indexOf("</article>", page.html.indexOf('id="LandingPage"'))
            )
        )
        page.html.includes('action="/marketing/Subscribe/request"') && page.html.includes("Garden news")
        page.html.includes("Yes, send me Garden news")
        !page.html.includes("Hidden news") && !page.html.includes("NO_SUCH_FORM")
        route.screenPath === "/Marketing/Page" && route.screenParameters.routePath === "spring"
        published.page.parts.filter(part => part.kind === "subscribe").length === 2
        ;[draft, unknown, noMount].every(x => x.kind === "NotFound")
        new Set([draft, unknown, noMount].map(x => x.error)).size === 1
    }
})
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
                !!pass.getMarketingPage && JSON.stringify(pass.getMarketingPage) === JSON.stringify(mantle.getMarketingPage),
            routed: routes.map(list => Array.from(list).find(route => route[2] === "getMarketingPage")?.[0]),
            written: lists.some(list => Array.from(list).includes("getMarketingPage"))
        }
    },
    then({inSchemas, routed, written}) {
        inSchemas
        routed.join() === "GET,GET"
        !written
    }
})
