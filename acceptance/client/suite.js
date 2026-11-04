// The acceptance client specs of mr-pass (./moq accept mr-pass), against mr-pass with the fixtures of test/.
suite(['ForumHttp'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures', 'PortalFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
})
