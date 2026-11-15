// PASS Marketing's tracking links on the HTTP test community (PASS_HTTP, from PortalFixtures; IronStone impl-marketing P15): on the
// Marketing mount MarketingSubscribeFixtures provisions (prefix PASS_HTTP_MK) and MarketingPagesFixtures' published landing page
// "spring", a campaign of the fixture organization with a tracking link to that page (/trk/PASS_HTTP/PassHttpTrk01, source poster,
// medium qr), and the organization's policy setting visitor keys, for the walk MarketingTrackingHttp.
const mk = () => ec.resource.script("component://mr-pass/test/Marketing/MarketingFixtures.js")
spec({
    dependsOn: ["PortalFixtures", "MarketingSubscribeFixtures", "MarketingPagesFixtures"],
    setupSpec() {
        login("john.doe")
    }
})
feature("provision a campaign link to the published landing page and the visitor-key policy", {
    when() {
        const fx = mk()
        const {make, row, system} = fx.lib
        const org = "PASS_HTTP_MK_ORG"
        const pages = fx.pages({siteId: "PASS_HTTP", org}, "")
        if (!row("mantle.marketing.tracking.TrackingCode", {trackingCodeId: "PASS_HTTP_MK_TRK"}))
            system(() => {
                const ago = new Date(Date.now() - 86400000)
                make("mantle.marketing.campaign.MarketingPolicy", {organizationPartyId: org, fromDate: ago, visitorKeys: "Y"})
                make("mantle.marketing.campaign.MarketingCampaign", {
                    marketingCampaignId: "PASS_HTTP_MK_CMP",
                    campaignName: "Spring on the HTTP site",
                    organizationPartyId: org,
                    statusId: "MKTG_CAMP_INPROGRESS"
                })
                make("mantle.marketing.tracking.TrackingCode", {
                    trackingCodeId: "PASS_HTTP_MK_TRK",
                    marketingCampaignId: "PASS_HTTP_MK_CMP",
                    organizationPartyId: org,
                    siteId: "PASS_HTTP",
                    publicCode: "PassHttpTrk01",
                    description: "Spring poster",
                    destinationKindEnumId: "TdkSitePage",
                    sitePageId: pages.spring,
                    utmSource: "poster",
                    utmMedium: "qr",
                    disabled: "N",
                    fromDate: ago
                })
            })
        return {link: row("mantle.marketing.tracking.TrackingCode", {trackingCodeId: "PASS_HTTP_MK_TRK"}), pages}
    },
    then(r) {
        r.link != null && r.link.sitePageId == r.pages.spring
    }
})
