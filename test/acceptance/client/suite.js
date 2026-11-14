// The acceptance client specs of mr-pass (./moq accept mr-pass), against mr-pass with the fixtures of test/ and
// SupplierPortalFixtures, SupportFixtures, ShopFixtures, SmithyWalkFixtures, SmithyContributionFixtures, SiteHostsFixtures, SalesQuoteFixtures, SalesOrderFixtures and MarketingSubscribeFixtures (test/acceptance/).
suite(['ForumHttp', 'SupplierPortalHttp', 'SupportFeedbackHttp', 'SupportPagesHttp', 'ShopHttp', 'ShopRemoteHttp', 'ShopCartHttp', 'ShopCartRemoteHttp', 'ShopCheckoutHttp', 'ShopAccessibilityHttp', 'SmithyWalk', 'SmithyContribution', 'SiteHostsHttp', 'SalesQuoteHttp', 'SalesOrderHttp', 'MarketingSubscribeHttp', 'MarketingRemoteHttp'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures', 'PortalFixtures', 'SupplierPortalFixtures', 'SupportFixtures', 'ShopFixtures', 'SmithyWalkFixtures', 'SmithyContributionFixtures', 'SiteHostsFixtures', 'SalesQuoteFixtures', 'SalesOrderFixtures', 'MarketingSubscribeFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
})
