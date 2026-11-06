// The acceptance client specs of mr-pass (./moq accept mr-pass), against mr-pass with the fixtures of test/ and
// SupplierPortalFixtures, SupportFixtures and ShopFixtures (acceptance/).
suite(['ForumHttp', 'SupplierPortalHttp', 'SupportFeedbackHttp', 'SupportPagesHttp', 'ShopHttp', 'ShopRemoteHttp', 'ShopCartHttp', 'ShopCartRemoteHttp', 'ShopCheckoutHttp', 'ShopAccessibilityHttp'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures', 'PortalFixtures', 'SupplierPortalFixtures', 'SupportFixtures', 'ShopFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
})
