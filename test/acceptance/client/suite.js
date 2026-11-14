// The acceptance client specs of mr-pass (./moq accept mr-pass), against mr-pass with the fixtures of test/ and
// SupplierPortalFixtures, SupportFixtures, ShopFixtures, SmithyWalkFixtures and SmithyContributionFixtures (test/acceptance/).
suite(['ForumHttp', 'SupplierPortalHttp', 'SupportFeedbackHttp', 'SupportPagesHttp', 'ShopHttp', 'ShopRemoteHttp', 'ShopCartHttp', 'ShopCartRemoteHttp', 'ShopCheckoutHttp', 'ShopAccessibilityHttp', 'SmithyWalk', 'SmithyContribution'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures', 'PortalFixtures', 'SupplierPortalFixtures', 'SupportFixtures', 'ShopFixtures', 'SmithyWalkFixtures', 'SmithyContributionFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
})
