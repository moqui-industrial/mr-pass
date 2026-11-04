// The acceptance client specs of mr-pass (./moq accept mr-pass), against mr-pass with the fixtures of test/ and
// SupplierPortalFixtures (acceptance/).
suite(['ForumHttp', 'SupplierPortalHttp'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures', 'PortalFixtures', 'SupplierPortalFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
})
