// The acceptance client specs of mr-pass (./moq accept mr-pass), against mr-pass with the fixtures of test/ and
// SupplierPortalFixtures, SupportFixtures, ShopFixtures, SmithyWalkFixtures, SmithyContributionFixtures, SiteHostsFixtures, SalesQuoteFixtures, SalesOrderFixtures, SalesPhoneFixtures, MarketingSubscribeFixtures, MarketingFormFixtures and MarketingPagesFixtures (test/acceptance/).
suite(['ForumHttp', 'SupplierPortalHttp', 'SupportFeedbackHttp', 'SupportPagesHttp', 'ShopHttp', 'ShopRemoteHttp', 'ShopCartHttp', 'ShopCartRemoteHttp', 'ShopCheckoutHttp', 'ShopAccessibilityHttp', 'SmithyWalk', 'SmithyContribution', 'SiteHostsHttp', 'SalesQuoteHttp', 'SalesOrderHttp', 'SalesPhonePages', 'MarketingSubscribeHttp', 'MarketingRemoteHttp', 'MarketingFormHttp', 'MarketingPagesHttp'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures', 'PortalFixtures', 'SupplierPortalFixtures', 'SupportFixtures', 'ShopFixtures', 'SmithyWalkFixtures', 'SmithyContributionFixtures', 'SiteHostsFixtures', 'SalesQuoteFixtures', 'SalesOrderFixtures', 'SalesPhoneFixtures', 'MarketingSubscribeFixtures', 'MarketingFormFixtures', 'MarketingPagesFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
})
