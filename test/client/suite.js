suite(['PortalHttp', 'ShopCheckoutWalk'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures', 'PortalFixtures', 'ShopWalkFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
})
