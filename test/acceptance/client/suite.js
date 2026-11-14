// The acceptance client specs of mr-pass (./moq accept mr-pass), against mr-pass with the fixtures of test/ and
// SupplierPortalFixtures, SupportFixtures, ShopFixtures and SmithyWalkFixtures (test/acceptance/).
suite(['ForumHttp', 'SupplierPortalHttp', 'SupportFeedbackHttp', 'SupportPagesHttp', 'ShopHttp', 'ShopRemoteHttp', 'ShopCartHttp', 'ShopCartRemoteHttp', 'ShopCheckoutHttp', 'ShopAccessibilityHttp', 'SmithyWalk'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures', 'PortalFixtures', 'SupplierPortalFixtures', 'SupportFixtures', 'ShopFixtures', 'SmithyWalkFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
})
