suite(['PortalHttp'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures', 'PortalFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
})
